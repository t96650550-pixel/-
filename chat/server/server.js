require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const db = require('./db');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' }
});

const JWT_SECRET = process.env.JWT_SECRET || 'verysecret';
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(cors());
app.use(helmet());

const limiter = rateLimit({ windowMs: 1000, max: 10 });
app.use(limiter);

// --- helpers ---
function authMiddleware(req,res,next){
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({error:'no token'});
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    db.get('SELECT * FROM users WHERE id=?', payload.id, (err,user)=>{
      if(err || !user) return res.status(401).json({error:'invalid user'});
      if(user.locked) return res.status(403).json({error:'locked'});
      req.userRow = user;
      next();
    });
  } catch(e){
    return res.status(401).json({error:'invalid token'});
  }
}

// --- auth routes ---
app.post('/api/register', upload.single('avatar'), async (req,res)=>{
  const { username, password, display_name } = req.body;
  if(!username || !password) return res.status(400).json({error:'missing'});
  const hash = await bcrypt.hash(password, 10);
  const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;
  db.run(
    `INSERT INTO users (username,password,display_name,avatar) VALUES (?,?,?,?)`,
    [username, hash, display_name||username, avatarPath],
    function(err){
      if(err) return res.status(400).json({error:err.message});
      const userId = this.lastID;
      const token = jwt.sign({id:userId, username}, JWT_SECRET, {expiresIn:'7d'});
      res.json({token});
    }
  );
});

app.post('/api/login', (req,res)=>{
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({error:'missing'});
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err,row)=>{
    if(err || !row) return res.status(400).json({error:'invalid'});
    if(row.locked) return res.status(403).json({error:'locked'});
    const ok = await bcrypt.compare(password, row.password);
    if(!ok) return res.status(400).json({error:'invalid'});
    const token = jwt.sign({id:row.id, username:row.username}, JWT_SECRET, {expiresIn:'7d'});
    res.json({token, user: {id:row.id, username:row.username, display_name:row.display_name, avatar:row.avatar, role:row.role}});
  });
});

// --- user endpoints ---
app.get('/api/me', authMiddleware, (req,res)=>{
  const u = req.userRow;
  res.json({id:u.id, username:u.username, display_name:u.display_name, avatar:u.avatar, role:u.role});
});

app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'no file'});
  const avatarPath = `/uploads/${req.file.filename}`;
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, req.user.id], (err)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json({avatar:avatarPath});
  });
});

// --- rooms ---
app.post('/api/rooms', authMiddleware, (req,res)=>{
  const { name, is_private } = req.body;
  db.run('INSERT INTO rooms (name,is_private,created_by) VALUES (?,?,?)', [name, is_private?1:0, req.user.id], function(err){
    if(err) return res.status(500).json({error:err.message});
    const roomId = this.lastID;
    // add creator as member
    db.run('INSERT INTO room_members (room_id,user_id) VALUES (?,?)', [roomId, req.user.id]);
    res.json({id:roomId, name});
  });
});

app.get('/api/rooms', authMiddleware, (req,res)=>{
  db.all('SELECT r.*, u.display_name as creator_name FROM rooms r LEFT JOIN users u ON r.created_by=u.id',[], (err,rows)=>{
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// --- admin endpoints ---
app.post('/api/admin/lock', authMiddleware, (req,res)=>{
  if(req.userRow.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const { userId, lock } = req.body;
  db.run('UPDATE users SET locked = ? WHERE id = ?', [lock?1:0, userId], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({ok:true});
  });
});

// --- retract message ---
app.post('/api/messages/:id/retract', authMiddleware, (req,res)=>{
  const msgId = req.params.id;
  db.get('SELECT * FROM messages WHERE id = ?', [msgId], (err,msg)=>{
    if(err || !msg) return res.status(404).json({error:'not found'});
    if(msg.sender_id !== req.user.id && req.userRow.role !== 'admin') return res.status(403).json({error:'not allowed'});
    // allow retract within 60s or admin always
    const created = new Date(msg.created_at).getTime();
    const now = Date.now();
    if(req.userRow.role !== 'admin' && (now - created) > 60000) return res.status(403).json({error:'too old'});
    db.run('UPDATE messages SET retracted = 1 WHERE id = ?', [msgId], function(err2){
      if(err2) return res.status(500).json({error:err2.message});
      io.to(`room_${msg.room_id}`).emit('message_retracted', {messageId: msgId});
      res.json({ok:true});
    });
  });
});

// serve uploaded files
app.use('/uploads', express.static(uploadDir));

// serve client build if present
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req,res) => res.sendFile(path.join(clientBuildPath, 'index.html')));
}

// --- Socket.io logic ---
const onlineUsers = new Map(); // userId -> socket.id (if multiple devices, use array)

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if(!token) return next(new Error('no token'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    db.get('SELECT * FROM users WHERE id=?', payload.id, (err,user)=>{
      if(err || !user) return next(new Error('invalid user'));
      if(user.locked) return next(new Error('locked'));
      socket.user = user;
      next();
    });
  } catch(e){
    next(new Error('auth error'));
  }
});

io.on('connection', (socket) => {
  const user = socket.user;
  // manage online
  if(!onlineUsers.has(user.id)) onlineUsers.set(user.id, []);
  onlineUsers.get(user.id).push(socket.id);
  io.emit('presence_update', {userId:user.id, online:true});

  // join rooms the user is a member of (or public rooms)
  db.all('SELECT room_id FROM room_members WHERE user_id = ?', [user.id], (err,rows)=>{
    if(rows && rows.length){
      rows.forEach(r => { socket.join(`room_${r.room_id}`); });
    } else {
      // optionally auto-join a global room "Lobby"
      socket.join('room_1');
    }
  });

  socket.on('join_room', ({roomId})=>{
    socket.join(`room_${roomId}`);
    db.run('INSERT OR IGNORE INTO room_members (room_id,user_id) VALUES (?,?)', [roomId, user.id]);
    io.to(`room_${roomId}`).emit('user_joined', {roomId, userId: user.id, display_name: user.display_name});
  });

  socket.on('leave_room', ({roomId})=>{
    socket.leave(`room_${roomId}`);
    db.run('DELETE FROM room_members WHERE room_id=? AND user_id=?', [roomId, user.id]);
    io.to(`room_${roomId}`).emit('user_left', {roomId, userId: user.id});
  });

  socket.on('typing', ({roomId, typing})=>{
    socket.to(`room_${roomId}`).emit('typing', {userId: user.id, typing});
  });

  socket.on('send_message', ({roomId, content, attachments})=>{
    db.run('INSERT INTO messages (room_id, sender_id, content, attachments) VALUES (?,?,?,?)',
      [roomId, user.id, content, attachments?JSON.stringify(attachments):null],
      function(err){
        if(err) return;
        const message = {
          id: this.lastID,
          room_id: roomId,
          sender_id: user.id,
          content,
          attachments,
          created_at: new Date().toISOString(),
          display_name: user.display_name,
          avatar: user.avatar
        };
        // emit to room
        io.to(`room_${roomId}`).emit('new_message', message);
      });
  });

  socket.on('read_message', ({messageId})=>{
    db.get('SELECT * FROM messages WHERE id=?', [messageId], (err,msg)=>{
      if(!msg) return;
      db.run('INSERT OR REPLACE INTO receipts (message_id, user_id, read_at) VALUES (?,?,CURRENT_TIMESTAMP)', [messageId, user.id]);
      io.to(`room_${msg.room_id}`).emit('message_read', {messageId, userId: user.id});
    });
  });

  socket.on('disconnect', ()=>{
    // remove socket id
    const arr = onlineUsers.get(user.id) || [];
    const idx = arr.indexOf(socket.id);
    if(idx > -1) arr.splice(idx,1);
    if(arr.length === 0) {
      onlineUsers.delete(user.id);
      io.emit('presence_update', {userId:user.id, online:false});
    } else {
      onlineUsers.set(user.id, arr);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, ()=> console.log(`Server running on ${PORT}`));