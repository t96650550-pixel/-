require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { db, init } = require('./db');
const { sendResetEmail } = require('./mailer');
const { v4: uuidv4 } = require('uuid');

init();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const ACCESS_EXP = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_EXP = process.env.REFRESH_TOKEN_EXPIRY || '7d';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';
const RESET_EXP_MIN = parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES || '30', 10);

const limiter = rateLimit({ windowMs: 60*1000, max: 80 });
app.use(limiter);

function signAccess(user) {
  return jwt.sign({ id: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}
function signRefresh(user) {
  return jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// helpers DB wrappers (promisified)
const run = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(err){ if(err) rej(err); else res(this); }));
const get = (sql, params=[]) => new Promise((res, rej) => db.get(sql, params, (err,row)=> err?rej(err):res(row)));
const all = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (err,rows)=> err?rej(err):res(rows)));

// Register
app.post('/api/register', async (req, res) => {
  try{
    const { email, username, password } = req.body;
    if(!email || !password) return res.status(400).json({error:'missing'});
    const pwHash = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (email, username, password_hash) VALUES (?,?,?)',[email, username||email, pwHash]);
    res.json({ok:true});
  }catch(e){
    console.error(e);
    res.status(500).json({error: e.message});
  }
});

// Login
app.post('/api/login', async (req,res) => {
  try{
    const { email, password } = req.body;
    const user = await get('SELECT * FROM users WHERE email=?',[email]);
    if(!user) return res.status(401).json({error:'invalid'});
    if(user.is_locked) return res.status(403).json({error:'locked'});
    const ok = await bcrypt.compare(password, user.password_hash);
    if(!ok) return res.status(401).json({error:'invalid'});
    const access = signAccess(user);
    const refresh = signRefresh(user);
    // store hashed refresh
    const h = hashToken(refresh);
    const expiresAt = new Date(Date.now() + 1000*60*60*24*7).toISOString();
    await run('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',[user.id, h, expiresAt]);
    // send refresh in httpOnly cookie
    res.cookie('refreshToken', refresh, { httpOnly:true, sameSite:'lax', maxAge:1000*60*60*24*7 });
    res.json({ access, user:{id:user.id, email:user.email, username:user.username, role:user.role}});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Refresh
app.post('/api/refresh', async (req,res) => {
  try{
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if(!token) return res.status(401).json({error:'no token'});
    let payload;
    try{ payload = jwt.verify(token, REFRESH_SECRET); } catch(err){ return res.status(401).json({error:'invalid'}); }
    const h = hashToken(token);
    const row = await get('SELECT * FROM refresh_tokens WHERE token_hash=? AND revoked=0',[h]);
    if(!row) return res.status(401).json({error:'not found'});
    // rotate refresh: revoke old row and insert new
    await run('UPDATE refresh_tokens SET revoked=1 WHERE id=?',[row.id]);
    const user = await get('SELECT * FROM users WHERE id=?',[payload.id]);
    const access = signAccess(user);
    const refresh = signRefresh(user);
    const nh = hashToken(refresh);
    const expiresAt = new Date(Date.now() + 1000*60*60*24*7).toISOString();
    await run('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',[user.id, nh, expiresAt]);
    res.cookie('refreshToken', refresh, { httpOnly:true, sameSite:'lax', maxAge:1000*60*60*24*7 });
    res.json({ access });
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Logout
app.post('/api/logout', async (req,res) => {
  try{
    const token = req.cookies.refreshToken || req.body.refreshToken;
    if(token){
      const h = hashToken(token);
      await run('UPDATE refresh_tokens SET revoked=1 WHERE token_hash=?',[h]);
    }
    res.clearCookie('refreshToken');
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Request password reset (user or admin triggers)
app.post('/api/request-reset', async (req,res) => {
  try{
    const { email } = req.body;
    if(!email) return res.status(400).json({error:'missing'});
    const user = await get('SELECT * FROM users WHERE email=?',[email]);
    if(!user) return res.status(404).json({error:'no user'});
    const token = uuidv4() + '-' + crypto.randomBytes(16).toString('hex');
    const h = hashToken(token);
    const expires = new Date(Date.now() + RESET_EXP_MIN*60*1000).toISOString();
    await run('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',[user.id, h, expires]);
    const link = (process.env.FRONTEND_URL || 'http://localhost:3001') + '/reset-password?token=' + token;
    // send email (will fail in dev without SMTP)
    try{ await sendResetEmail(user.email, link); } catch(err){ console.warn('mailer failed', err.message); }
    res.json({ok:true, link}); // return link for dev convenience
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Reset password (token + new password)
app.post('/api/reset-password', async (req,res) => {
  try{
    const { token, newPassword } = req.body;
    if(!token || !newPassword) return res.status(400).json({error:'missing'});
    const h = hashToken(token);
    const row = await get('SELECT * FROM password_reset_tokens WHERE token_hash=? AND used=0',[h]);
    if(!row) return res.status(400).json({error:'invalid'});
    if(new Date(row.expires_at) < new Date()) return res.status(400).json({error:'expired'});
    const pwHash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash=? WHERE id=?',[pwHash, row.user_id]);
    await run('UPDATE password_reset_tokens SET used=1 WHERE id=?',[row.id]);
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Admin: reset another user's password (simple endpoint, admin-only)
app.post('/api/admin/reset-user-password', async (req,res) => {
  try{
    const auth = req.headers.authorization?.split(' ')[1];
    if(!auth) return res.status(401).json({error:'no auth'});
    let payload;
    try{ payload = jwt.verify(auth, ACCESS_SECRET); } catch(e){ return res.status(401).json({error:'invalid'}); }
    const admin = await get('SELECT * FROM users WHERE id=?',[payload.id]);
    if(!admin || admin.role !== 'admin') return res.status(403).json({error:'not admin'});
    const { userId, newPassword } = req.body;
    if(!userId || !newPassword) return res.status(400).json({error:'missing'});
    const pwHash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash=? WHERE id=?',[pwHash, userId]);
    res.json({ok:true});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Admin: list users
app.get('/api/admin/users', async (req,res) => {
  try{
    const auth = req.headers.authorization?.split(' ')[1];
    if(!auth) return res.status(401).json({error:'no auth'});
    let payload;
    try{ payload = jwt.verify(auth, ACCESS_SECRET); } catch(e){ return res.status(401).json({error:'invalid'}); }
    const admin = await get('SELECT * FROM users WHERE id=?',[payload.id]);
    if(!admin || admin.role !== 'admin') return res.status(403).json({error:'not admin'});
    const users = await all('SELECT id,email,username,role,is_locked,created_at FROM users');
    res.json({users});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// Protected simple ping
app.get('/api/me', async (req,res) => {
  try{
    const auth = req.headers.authorization?.split(' ')[1];
    if(!auth) return res.status(401).json({error:'no auth'});
    let payload;
    try{ payload = jwt.verify(auth, ACCESS_SECRET); } catch(e){ return res.status(401).json({error:'invalid'}); }
    const user = await get('SELECT id,email,username,role,is_locked FROM users WHERE id=?',[payload.id]);
    if(!user) return res.status(404).json({error:'no user'});
    res.json({user});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

// socket auth middleware
io.use(async (socket, next) => {
  try{
    const token = socket.handshake.auth?.token;
    if(!token) return next(new Error('no token'));
    const payload = jwt.verify(token, ACCESS_SECRET);
    socket.user = payload;
    return next();
  }catch(e){ return next(new Error('unauthorized')); }
});

io.on('connection', (socket) => {
  console.log('socket connected', socket.user.id);
  socket.on('send_message', async (data) => {
    // save to DB and broadcast
    try{
      await run('INSERT INTO messages (from_user, content) VALUES (?,?)',[socket.user.id, data.text]);
      const msg = await get('SELECT m.id, m.content, m.created_at, u.username as from_username FROM messages m JOIN users u ON u.id=m.from_user WHERE m.rowid = last_insert_rowid()');
      io.emit('new_message', msg);
    }catch(e){ console.error(e); }
  });
});

// short endpoint to list last 50 messages
app.get('/api/messages', async (req,res) => {
  try{
    const rows = await all('SELECT m.id, m.content, m.created_at, u.username as from_username FROM messages m JOIN users u ON u.id=m.from_user ORDER BY m.id DESC LIMIT 50');
    res.json({messages: rows.reverse()});
  }catch(e){ console.error(e); res.status(500).json({error:e.message});}
});

server.listen(PORT, ()=> console.log('Server listening on', PORT));
