const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

// Dùng /tmp cho Render (vì Render không cho ghi root)
const dbPath =
  process.env.NODE_ENV === "production"
    ? path.join("/tmp", "chat.db")
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
    // Bảng người dùng
    db.run(
      `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        display_name TEXT,
        is_admin INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0
      )
      `,
      (err) => {
        if (err) console.error("❌ Lỗi tạo bảng users:", err.message);
      }
    );

    // Bảng tin nhắn
    db.run(
      `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        display_name TEXT,
        text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
      `,
      (err) => {
        if (err) console.error("❌ Lỗi tạo bảng messages:", err.message);
      }
    );

    // ✅ Tạo admin mặc định nếu chưa có
    db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
      if (err) {
        console.error("❌ Lỗi kiểm tra admin:", err.message);
        return;
      }

      if (!row) {
        const hashed = bcrypt.hashSync("admin123", 10);
        db.run(
          `INSERT INTO users (username, password, display_name, is_admin) VALUES (?, ?, ?, 1)`,
          ["admin", hashed, "Administrator"],
          (err) => {
            if (err) {
              console.error("❌ Lỗi tạo admin mặc định:", err.message);
            } else {
              console.log("✅ Tạo tài khoản admin mặc định (admin / admin123)");
            }
          }
        );
      }
    });
  });
}

module.exports = { db, init };
