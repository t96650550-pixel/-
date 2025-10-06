const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.SQLITE_FILE || path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

const init = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      is_locked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token_hash TEXT,
      expires_at DATETIME,
      revoked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      token_hash TEXT,
      expires_at DATETIME,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
};

module.exports = { db, init };
