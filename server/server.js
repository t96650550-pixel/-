require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const { db, init } = require('./db');
init();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 3001;

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());

// Simple helpers
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token){
  try{
    return jwt.verify(token, JWT_SECRET);
  }catch(e){ return null; }
}

// Auth routes
app.post('/api/register', async (req,res)=>{
  const { username, password, display_name } = req.body;
  if(!username || !password) return res.status(400).json({error:'Username & password required'});
  const hashed = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username,password,display_name) VALUES (?,?,?)`,
    [username,hashed,display_name || username], function(err){
      if(err){
        return res.status(400).json({error: 'Username exists'});
      }
      const user = { id: this.lastID, username, display_name: display_name || username, is_admin:0 };
      const token = signToken(user);
      res.json({ user, token });
    });
});

app.post('/api/login', (req,res)=>{
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err,row)=>{
    if(err) return res.status(500).json({error:'DB error'});
    if(!row) return res.status(400).json({error:'Invalid credentials'});
    if(row.is_locked) return res.status(403).json({error:'Account locked'});
    const ok = await bcrypt.compare(password, row.password);
    if(!ok) return res.status(400).json({error:'Invalid credentials'});
    const user = { id: row.id, username: row.username, display_name: row.display_name, is_admin: row.is_admin };
    const token = signToken(user);
    res.json({ user, token });
  });
});

// Admin: lock/unlock user (must be admin)
app.post('/api/admin/toggle-lock', (req,res)=>{
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  const payload = verifyToken(token);
  if(!payload || !payload.is_admin) return res.status(403).json({error:'Forbidden'});
  const { userId, lock } = req.body;
  db.run('UPDATE users SET is_locked = ? WHERE id = ?', [lock?1:0, userId], function(err){
    if(err) return res.status(500).json({error:'DB error'});
    res.json({ success:true });
  });
});

// get recent messages & users
app.get('/api/messages', (req,res)=>{
  db.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200', [], (err,rows)=>{
    if(err) return res.status(500).json({error:'DB error'});
    res.json(rows.reverse());
  });
});
app.get('/api/users', (req,res)=>{
  db.all('SELECT id,username,display_name,is_admin,is_locked FROM users', [], (err,rows)=>{
    if(err) return res.status(500).json({error:'DB error'});
    res.json(rows);
  });
});

// serve static for client in production if built
if(process.env.NODE_ENV === 'production'){
  app.use(express.static(path.join(__dirname,'..','client','build')));
  app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','client','build','index.html')));
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' }
});

// socket auth middleware (simple)
io.use((socket, next)=>{
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if(!token) return next();
  const p = verifyToken(token);
  if(p) socket.user = p;
  next();
});

io.on('connection', (socket)=>{
  // If user is authenticated, attach display name
  const user = socket.user || null;
  socket.on('send_message', (msg)=>{
    if(user && user.id){
      // check if locked
      db.get('SELECT is_locked FROM users WHERE id = ?', [user.id], (err,row)=>{
        if(err) return;
        if(row && row.is_locked) return socket.emit('error_message','Account locked');
        const display_name = user.display_name || user.username;
        db.run('INSERT INTO messages (user_id, display_name, text) VALUES (?,?,?)',
          [user.id, display_name, msg], function(err){
            if(err) return;
            const message = { id: this.lastID, user_id: user.id, display_name, text: msg, created_at: new Date().toISOString() };
            io.emit('message', message);
          });
      });
    } else {
      // guest
      const display_name = 'Guest';
      db.run('INSERT INTO messages (user_id, display_name, text) VALUES (NULL,?,?)',
        [display_name, msg], function(err){
          if(err) return;
          const message = { id: this.lastID, user_id: null, display_name, text: msg, created_at: new Date().toISOString() };
          io.emit('message', message);
        });
    }
  });
});

httpServer.listen(PORT, ()=> {
  console.log('Server started on', PORT);
});
