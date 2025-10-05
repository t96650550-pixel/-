const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath =
  process.env.NODE_ENV === "production"
    ? path.join("/tmp", "chat.db") // Render chỉ ghi được /tmp
    : path.join(__dirname, "chat.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Lỗi mở database:", err.message);
  } else {
    console.log("✅ Kết nối SQLite thành công:", dbPath);
  }
});

function init() {
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        display_name TEXT,
        is_admin INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0
      )`,
      (err) => {
        if (err) console.error("❌ Lỗi tạo bảng users:", err.message);
      }
    );

    db.run(
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        display_name TEXT,
        text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) console.error("❌ Lỗi tạo bảng messages:", err.message);
      }
    );
  });
}

module.exports = { db, init };
