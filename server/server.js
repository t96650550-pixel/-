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
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const JWT_SECRET = 'replace_with_strong_secret_in_prod';
const PORT = process.env.PORT || 4000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// rate limiter
app.use(rateLimit({
  windowMs: 1000 * 60,
  max: 200
}));

// === STATIC FRONTEND ===
app.use(express.static(path.join(__dirname, 'public')));

// fallback cho "/" → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === UPLOADS FOLDER ===
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

app.use('/uploads', express.static(UPLOADS));

// === DATABASE ===
const DB_FILE = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    display_name TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    sender_name TEXT,
    room TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// === HELPERS ===
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token' });
  const token = auth.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// === ROUTES ===

// register
app.post('/api/register', (req, res) => {
  const { username, password, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'hash error' });
    const stmt = db.prepare("INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)");
    stmt.run(username, hash, display_name || username, function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'username_taken' });
        return res.status(500).json({ error: 'db error' });
      }
      const user = { id: this.lastID, username, role: 'user' };
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, username, display_name: display_name || username } });
    });
  });
});

// login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username & password required' });
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
    if (err) return res.status(500).json({ error: 'db error' });
    if (!row) return res.status(401).json({ error: 'invalid_credentials' });
    bcrypt.compare(password, row.password, (err, ok) => {
      if (err) return res.status(500).json({ error: 'compare error' });
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
      const token = generateToken(row);
      res.json({ token, user: { id: row.id, username: row.username, display_name: row.display_name, avatar: row.avatar, role: row.role } });
    });
  });
});

// upload avatar
app.post('/api/upload-avatar', authMiddleware, upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${path.basename(req.file.path)}`;
  db.run("UPDATE users SET avatar = ? WHERE id = ?", [fileUrl, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json({ avatar: fileUrl });
  });
});

// upload media
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  const fileUrl = `/uploads/${path.basename(req.file.path)}`;
  res.json({ url: fileUrl });
});

// get messages
app.get('/api/messages/:room', authMiddleware, (req, res) => {
  const room = req.params.room || 'global';
  db.all("SELECT * FROM messages WHERE room = ? ORDER BY created_at ASC LIMIT 1000", [room], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json(rows);
  });
});

// get users
app.get('/api/users', authMiddleware, (req, res) => {
  db.all("SELECT id, username, display_name, avatar, role FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db error' });
    res.json(rows);
  });
});

// post message
app.post('/api/messages', authMiddleware, (req, res) => {
  const { room = 'global', content, type = 'text', url = null } = req.body;
  db.run("INSERT INTO messages (sender_id, sender_name, room, content, type, url) VALUES (?, ?, ?, ?, ?, ?)",
    [req.user.id, req.user.username, room, content, type, url], function(err) {
      if (err) return res.status(500).json({ error: 'db error' });
      const msg = {
        id: this.lastID, sender_id: req.user.id, sender_name: req.user.username,
        room, content, type, url, created_at: new Date().toISOString()
      };
      io.to(room).emit('message', msg);
      res.json(msg);
  });
});

// === SOCKET.IO ===
const online = {};
io.on('connection', (socket) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    socket.data.user = { id: null, username: 'Guest' };
  } else {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.user = decoded;
    } catch (e) {
      socket.data.user = { id: null, username: 'Guest' };
    }
  }

  socket.on('join', (room = 'global') => {
    socket.join(room);
    socket.data.room = room;
    online[socket.id] = { userId: socket.data.user.id, username: socket.data.user.username, room };
    io.to(room).emit('user_list', Object.values(online).filter(o => o.room === room));
    socket.to(room).emit('notification', { text: `${socket.data.user.username} đã vào phòng.` });
  });

  socket.on('typing', (payload) => {
    const room = socket.data.room || 'global';
    socket.to(room).emit('typing', { username: socket.data.user.username, ...payload });
  });

  socket.on('send_message', (payload) => {
    const room = payload.room || socket.data.room || 'global';
    const stmt = db.prepare("INSERT INTO messages (sender_id, sender_name, room, content, type, url) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(socket.data.user.id, socket.data.user.username, room, payload.content || '', payload.type || 'text', payload.url || null, function(err) {
      if (err) return;
      const msg = {
        id: this.lastID,
        sender_id: socket.data.user.id,
        sender_name: socket.data.user.username,
        room, content: payload.content, type: payload.type || 'text', url: payload.url || null,
        created_at: new Date().toISOString()
      };
      io.to(room).emit('message', msg);
    });
  });

  socket.on('disconnect', () => {
    const room = socket.data.room;
    delete online[socket.id];
    if (room) io.to(room).emit('user_list', Object.values(online).filter(o => o.room === room));
  });
});

// === START SERVER ===
server.listen(PORT, () => {
  console.log(`🚀 Chat server running on http://localhost:${PORT}`);
});
