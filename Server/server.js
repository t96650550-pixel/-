require('dotenv').config();
const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Too many login attempts, try again later' }
});

// SQLite DB
const DBSOURCE = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(DBSOURCE, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('Connected to SQLite.');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    displayName TEXT,
    password TEXT,
    role TEXT,
    disabled INTEGER DEFAULT 0,
    disabled_until DATETIME,
    email TEXT,
    email_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    action TEXT,
    target_id INTEGER,
    meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER,
    to_id INTEGER,
    room TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helpers
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '2h';

function dbGet(sql, params=[]) {
  return new Promise((res, rej) => db.get(sql, params, (e, r) => e?rej(e):res(r)));
}
function dbAll(sql, params=[]) {
  return new Promise((res, rej) => db.all(sql, params, (e, r) => e?rej(e):res(r)));
}
function dbRun(sql, params=[]) {
  return new Promise((res, rej) => db.run(sql, params, function(e){ e?rej(e):res({ lastID:this.lastID, changes:this.changes }); }));
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}
function signRefresh(user) {
  return jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
}

async function audit(actorId, action, targetId = null, meta = null) {
  await dbRun('INSERT INTO audit (actor_id, action, target_id, meta) VALUES (?,?,?,?)', [actorId, action, targetId, JSON.stringify(meta||{})]);
}

// create default superadmin if not exists
(async ()=>{
  const sa = await dbGet('SELECT * FROM users WHERE username = ?', ['superadmin']).catch(()=>null);
  if (!sa) {
    const pw = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@123';
    const hash = await bcrypt.hash(pw, 10);
    await dbRun('INSERT INTO users (username, displayName, password, role, email_verified) VALUES (?,?,?,?,1)', ['superadmin','Super Admin',hash,'superadmin']);
    console.log('Created default superadmin (change password).');
  }
})();

// Mailer (nodemailer)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// Middlewares
function authMiddleware(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error: 'No token' });
  const token = h.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = payload;
    next();
  });
}
function roleCheck(minRole) {
  const order = ['user','manager','admin','superadmin'];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No user' });
    const uIdx = order.indexOf(req.user.role);
    const mIdx = order.indexOf(minRole);
    if (uIdx >= 0 && uIdx >= mIdx) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

// --- Routes

// login
app.post('/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]).catch(()=>null);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.disabled) return res.status(403).json({ error: 'Account disabled' });
  if (user.disabled_until && new Date(user.disabled_until) > new Date()) return res.status(403).json({ error: 'Account disabled until ' + user.disabled_until });
  const ok = await bcrypt.compare(password, user.password || '');
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  const refresh = signRefresh(user);
  await audit(user.id, 'login', user.id, { ip: req.ip });
  res.json({ token, refresh, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, email_verified: user.email_verified } });
});

// refresh
app.post('/auth/refresh', async (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ error: 'No refresh token' });
  jwt.verify(refresh, REFRESH_SECRET, async (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid refresh' });
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [payload.id]).catch(()=>null);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const token = signToken(user);
    res.json({ token });
  });
});

// register (public) with email verify
app.post('/auth/register', async (req, res) => {
  const { username, password, displayName, email, recaptchaToken } = req.body;
  // NOTE: server should verify recaptcha token with Google; sample endpoint /verify-recaptcha exists below
  if (!username || !password || !email) return res.status(400).json({ error: 'Missing' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await dbRun('INSERT INTO users (username, displayName, password, role, email, email_verified) VALUES (?,?,?,?,?,?)',
      [username, displayName||username, hash, 'user', email, 0]);
    const userId = r.lastID;
    const verifyToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
    const verifyUrl = `${req.protocol}://${req.get('host')}/auth/verify-email?token=${verifyToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Verify your email',
      html: `Click to verify: <a href="${verifyUrl}">${verifyUrl}</a>`
    });
    res.json({ ok: true, message: 'Registered. Check your email to verify.' });
  } catch (err) {
    if (String(err).includes('UNIQUE')) return res.status(400).json({ error: 'Username exists' });
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
});

// verify email link
app.get('/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return res.status(400).send('Invalid or expired');
    await dbRun('UPDATE users SET email_verified = 1 WHERE id = ?', [payload.id]);
    res.send('Email verified — you can close this page.');
  });
});

// verify recaptcha server-side
app.post('/verify-recaptcha', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false });
  const secret = process.env.RECAPTCHA_SECRET;
  try {
    const r = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`
    });
    const j = await r.json();
    res.json(j);
  } catch (err) { res.status(500).json({ success: false }); }
});

// Admin: create user (admin+). superadmin-only for creating admin roles.
app.post('/admin/users', authMiddleware, roleCheck('admin'), async (req, res) => {
  try {
    const actor = req.user;
    const { username, displayName, password, role='user', email, requireEmailVerify=false, disabledUntil=null } = req.body;
    if ((role === 'admin' || role === 'superadmin') && actor.role !== 'superadmin') return res.status(403).json({ error: 'Only superadmin can create admin' });
    const pw = password || (Math.random().toString(36).slice(-8) + 'A1!');
    const hash = await bcrypt.hash(pw, 10);
    const r = await dbRun('INSERT INTO users (username, displayName, password, role, email, email_verified, disabled, disabled_until) VALUES (?,?,?,?,?,?,?,?)',
      [username, displayName||username, hash, role, email, requireEmailVerify?0:1, disabledUntil?1:0, disabledUntil]);
    await audit(actor.id, 'create_user', r.lastID, { username, role, email });
    res.json({ ok: true, user: { id: r.lastID, username, displayName, role, email, tempPassword: pw } });
  } catch (err) {
    if (String(err).includes('UNIQUE')) return res.status(400).json({ error: 'Username exists' });
    console.error(err); res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list users
app.get('/admin/users', authMiddleware, roleCheck('admin'), async (req, res) => {
  const rows = await dbAll('SELECT id, username, displayName, role, email, disabled, disabled_until, email_verified, created_at FROM users ORDER BY id DESC');
  res.json({ users: rows });
});

// Admin: disable / enable
app.post('/admin/users/:id/disable', authMiddleware, roleCheck('admin'), async (req, res) => {
  const actor = req.user;
  const targetId = req.params.id;
  const { type='temp', until=null, reason=null } = req.body;
  const t = await dbGet('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!t) return res.status(404).json({ error: 'Not found' });
  if (type === 'forever') {
    await dbRun('UPDATE users SET disabled = 1, disabled_until = NULL WHERE id = ?', [targetId]);
    await audit(actor.id, 'disable_forever', targetId, { reason });
  } else {
    await dbRun('UPDATE users SET disabled = 1, disabled_until = ? WHERE id = ?', [until, targetId]);
    await audit(actor.id, 'disable_temp', targetId, { until, reason });
  }
  res.json({ ok: true });
});
app.post('/admin/users/:id/enable', authMiddleware, roleCheck('admin'), async (req, res) => {
  const actor = req.user;
  const targetId = req.params.id;
  await dbRun('UPDATE users SET disabled = 0, disabled_until = NULL WHERE id = ?', [targetId]);
  await audit(actor.id, 'enable_user', targetId, {});
  res.json({ ok: true });
});

// Admin: change role
app.put('/admin/users/:id/role', authMiddleware, roleCheck('admin'), async (req, res) => {
  const actor = req.user;
  const id = req.params.id; const { role } = req.body;
  if ((role === 'admin' || role === 'superadmin') && actor.role !== 'superadmin') return res.status(403).json({ error: 'Only superadmin can assign admin' });
  await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  await audit(actor.id, 'change_role', id, { role });
  res.json({ ok: true });
});

// profile
app.get('/me', authMiddleware, async (req, res) => {
  const user = await dbGet('SELECT id, username, displayName, role, email, email_verified FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user });
});

// Socket.IO: chat + webrtc signalling
const onlineUsers = {}; // userId -> [socketIds]
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return next(new Error('Auth error'));
    socket.user = payload; next();
  });
});
io.on('connection', (socket) => {
  const uid = socket.user.id;
  onlineUsers[uid] = onlineUsers[uid] || [];
  onlineUsers[uid].push(socket.id);
  console.log('connected', uid, socket.id);

  socket.on('join_room', ({ room }) => socket.join(room));
  socket.on('message', async (data) => {
    const { toId, room, content } = data;
    await dbRun('INSERT INTO messages (from_id,to_id,room,content) VALUES (?,?,?,?)', [socket.user.id, toId||null, room||null, content]);
    if (room) io.to(room).emit('message', { from: socket.user.id, content, created_at: new Date() });
    else if (toId) (onlineUsers[toId]||[]).forEach(sid => io.to(sid).emit('message', { from: socket.user.id, content, created_at: new Date() }));
  });

  // WebRTC signaling events
  socket.on('webrtc-offer', ({ toId, sdp }) => (onlineUsers[toId]||[]).forEach(sid => io.to(sid).emit('webrtc-offer', { from: socket.user.id, sdp })));
  socket.on('webrtc-answer', ({ toId, sdp }) => (onlineUsers[toId]||[]).forEach(sid => io.to(sid).emit('webrtc-answer', { from: socket.user.id, sdp })));
  socket.on('webrtc-ice', ({ toId, candidate }) => (onlineUsers[toId]||[]).forEach(sid => io.to(sid).emit('webrtc-ice', { from: socket.user.id, candidate })));

  socket.on('disconnect', () => {
    onlineUsers[uid] = (onlineUsers[uid]||[]).filter(sid => sid !== socket.id);
    if ((onlineUsers[uid]||[]).length === 0) delete onlineUsers[uid];
  });
});

// Serve client build if exists
const clientBuild = path.join(__dirname, 'client', 'build');
app.use(express.static(clientBuild));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'), err => {
    if (err) res.status(500).send(err);
  });
});

// Start server
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`Server listening on ${port}`));
