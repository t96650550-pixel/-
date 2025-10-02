const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    displayName TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    locked INTEGER DEFAULT 0, -- 0 active, 1 temp-locked, 2 permanently locked
    lock_reason TEXT
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    username TEXT,
    displayName TEXT,
    type TEXT, -- text or voice
    content TEXT, -- text or file path
    createdAt INTEGER,
    recalled INTEGER DEFAULT 0,
    recallAllowedUntil INTEGER
  );`);
});

module.exports = db;
