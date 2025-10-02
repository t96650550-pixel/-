require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

const db = require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 3000;

// middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 200 }));

// file upload setup for voice memos
const uploadDir = path.join(__dirname, 'uploads','voices');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + (file.originalname || 'voice.webm')); }
});
const upload = multer({ storage });

// routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// serve voices
app.use('/voices', express.static(uploadDir));

// message history (simple)
app.get('/api/messages', (req,res) => {
  db.all(`SELECT * FROM messages ORDER BY createdAt DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({error:'db'});
    res.json(rows.reverse());
  });
});

// upload voice
app.post('/api/voice', upload.single('voice'), (req,res) => {
  // expects Authorization header with Bearer token to link user
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error:'no auth' });
  let user;
  try { user = jwt.verify(auth, JWT_SECRET); } catch(e){ return res.status(401).json({error:'invalid token'}); }
  if (!req.file) return res.status(400).json({ error:'no file' });
  const urlPath = '/voices/' + req.file.filename;
  const now = Date.now();
  const recallWindowMs = 60*1000; // 1 minute recall window
  db.run(`INSERT INTO messages (userId,username,displayName,type,content,createdAt,recallAllowedUntil) VALUES (?,?,?,?,?,?,?)`,
    [user.id, user.username, user.username, 'voice', urlPath, now, now + recallWindowMs], function(err){
      if(err) return res.status(500).json({error:'db'});
      const msg = { id: this.lastID, userId: user.id, username: user.username, displayName: user.username, type:'voice', content: urlPath, createdAt: now, recalled:0 };
      io.emit('message', msg);
      res.json(msg);
    });
});

// recall message via API (also via socket event allowed)
app.post('/api/recall', (req,res) => {
  const { messageId } = req.body;
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error:'no auth' });
  let user;
  try { user = jwt.verify(auth, JWT_SECRET); } catch(e){ return res.status(401).json({error:'invalid token'}); }
  db.get(`SELECT * FROM messages WHERE id = ?`, [messageId], (err, row) => {
    if (err || !row) return res.status(404).json({error:'not found'});
    // allow recall if owner & within recallAllowedUntil OR admin
    const isAdmin = user.role === 'admin';
    const isOwner = row.userId === user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({error:'no permission'});
    if (!isAdmin && Date.now() > (row.recallAllowedUntil || 0)) return res.status(403).json({error:'recall window expired'});
    db.run(`UPDATE messages SET recalled=1 WHERE id=?`, [messageId], function(err){
      if (err) return res.status(500).json({error:'db'});
      io.emit('recall', { id: messageId });
      res.json({ ok:true });
    });
  });
});

// socket auth helper
function verifyToken(token){
  try { return jwt.verify(token, JWT_SECRET); } catch(e){ return null; }
}

// socket.io events
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = verifyToken(token);
  if (!user) return next(new Error('unauthorized'));
  socket.user = user;
  next();
});

io.on('connection', (socket) => {
  const u = socket.user;
  socket.join('global'); // single-room chat for now
  socket.emit('connected', { user: { id: u.id, username: u.username, role: u.role }});
  socket.on('sendMessage', (data) => {
    // data: { type: 'text'|'voice', content: '...' }
    // check if user locked
    db.get(`SELECT locked FROM users WHERE id=?`, [u.id], (err,row)=>{
      if (row && row.locked && row.locked!=0) return socket.emit('errorMsg', 'account_locked');
      const now = Date.now();
      const recallWindowMs = 60*1000; // 1 minute recall
      db.run(`INSERT INTO messages (userId,username,displayName,type,content,createdAt,recallAllowedUntil) VALUES (?,?,?,?,?,?,?)`,
        [u.id, u.username, u.username, data.type||'text', data.content, now, now + recallWindowMs], function(err){
          if (err) return;
          const msg = { id: this.lastID, userId: u.id, username: u.username, displayName: u.username, type: data.type||'text', content: data.content, createdAt: now, recalled:0 };
          io.to('global').emit('message', msg);
        }
      );
    });
  });

  socket.on('recallMessage', ({ id }) => {
    // attempt recall via socket (same logic as API)
    db.get(`SELECT * FROM messages WHERE id = ?`, [id], (err, row) => {
      if (err||!row) return;
      const isAdmin = u.role === 'admin';
      const isOwner = row.userId === u.id;
      if (!isAdmin && !isOwner) return socket.emit('errorMsg','no_permission');
      if (!isAdmin && Date.now() > (row.recallAllowedUntil || 0)) return socket.emit('errorMsg','recall_expired');
      db.run(`UPDATE messages SET recalled=1 WHERE id=?`, [id], function(err){
        io.to('global').emit('recall', { id });
      });
    });
  });

  socket.on('typing', (who) => {
    socket.to('global').emit('typing', { username: u.username });
  });

  socket.on('disconnect', ()=>{});
});


// serve client in production (if you build client into server/static)
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('*', (req,res)=> {
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
