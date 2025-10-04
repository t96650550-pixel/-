const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DB file will be ./data/chat.db
const dbPath = process.env.SQLITE_PATH || path.join(__dirname,'data','chat.db');

const db = new sqlite3.Database(dbPath);

function init(){
  db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      display_name TEXT,
      is_admin INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      display_name TEXT,
      text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

module.exports = { db, init };
