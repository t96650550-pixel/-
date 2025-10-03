// server/db.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbPromise = open({
  filename: process.env.SQLITE_FILE || path.join(__dirname, 'chat.db'),
  driver: sqlite3.Database
});

module.exports = {
  run: async (sql, params=[]) => {
    const db = await dbPromise; return db.run(sql, params);
  },
  get: async (sql, params=[]) => {
    const db = await dbPromise; return db.get(sql, params);
  },
  all: async (sql, params=[]) => {
    const db = await dbPromise; return db.all(sql, params);
  }
};
