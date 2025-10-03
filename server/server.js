// server/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const socketio = require('socket.io');
const db = require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/messages');
const { verifyTokenSocket, verifyTokenMiddleware } = require('./middlewares/auth');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' }
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 1000 * 20,
  max: 50
});
app.use(limiter);

// routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', verifyTokenMiddleware, adminRoutes);
app.use('/api/messages', verifyTokenMiddleware, messageRoutes);

// socket auth & events
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const user = await verifyTokenSocket(token);
    if (!user) return next(new Error('Unauthorized'));
    socket.user = user;
    return next();
  } catch (err) { next(err); }
});

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log('connected', user.username, user.id);
  // join room global
  socket.join('global');

  // send last 100 messages
  const msgs = await db.all('SELECT * FROM messages WHERE deleted = 0 ORDER BY created_at DESC LIMIT 100');
  socket.emit('history', msgs.reverse());

  socket.on('sendMessage', async (payload) => {
    try {
      // check banned/locked
      const row = await db.get('SELECT banned, locked FROM users WHERE id = ?', [user.id]);
      if (!row) return;
      if (row.banned || row.locked) {
        socket.emit('actionDenied', { reason: 'Bạn bị khóa/cấm.' });
        return;
      }
      const content = String(payload.content || '').trim();
      if (!content) return;
      // insert
      const now = Date.now();
      const res = await db.run(
        `INSERT INTO messages (user_id, username, content, created_at, is_system, deleted) VALUES (?, ?, ?, ?, 0, 0)`,
        [user.id, user.username, content, now]
      );
      const msg = {
        id: res.lastID,
        user_id: user.id,
        username: user.username,
        content,
        created_at: now,
        is_system: 0,
        deleted: 0
      };
      io.to('global').emit('newMessage', msg);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnected', user.username);
  });
});

// create tables if not exists
(async () => {
  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    locked INTEGER DEFAULT 0,
    banned INTEGER DEFAULT 0,
    reset_token TEXT,
    reset_exp INTEGER
  )`);
  await db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    content TEXT,
    created_at INTEGER,
    is_system INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0
  )`);
})();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening ${PORT}`));
