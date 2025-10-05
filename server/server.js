require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { db, init } = require("./db");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(helmet());

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

init();

// ✅ Debug log DB
db.on("trace", (sql) => console.log("🪶 SQL:", sql));
db.on("profile", (sql, time) => console.log(`⏱ ${time}ms: ${sql}`));
db.on("error", (err) => console.error("🔥 SQLite error:", err.message));

// ✅ Middleware auth
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Thiếu token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    console.error("⚠️ Lỗi JWT:", e.message);
    return res.status(403).json({ error: "Token không hợp lệ" });
  }
}

// ✅ Đăng ký
app.post("/api/register", (req, res) => {
  const { username, password, display_name } = req.body;
  console.log("📩 Register request:", req.body);

  if (!username || !password || !display_name)
    return res.status(400).json({ error: "Thiếu thông tin đăng ký" });

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)`,
    [username, hashedPassword, display_name],
    function (err) {
      if (err) {
        console.error("❌ SQL Error (register):", err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log(`✅ Đăng ký thành công: ${username}`);
      return res.json({ success: true });
    }
  );
});

// ✅ Đăng nhập
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log("📩 Login request:", req.body);

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err) {
      console.error("🔥 SQL Error (login):", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      console.warn("⚠️ Không tìm thấy tài khoản:", username);
      return res.status(404).json({ error: "Không tìm thấy tài khoản" });
    }

    if (user.is_locked) return res.status(403).json({ error: "Tài khoản bị khóa" });

    if (!bcrypt.compareSync(password, user.password)) {
      console.warn("⚠️ Sai mật khẩu cho:", username);
      return res.status(401).json({ error: "Sai mật khẩu" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: !!user.is_admin },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`🔓 ${username} đăng nhập thành công`);
    res.json({
      success: true,
      token,
      display_name: user.display_name,
      is_admin: user.is_admin,
    });
  });
});

// ✅ Admin khóa/mở tài khoản
app.post("/api/admin/lock", auth, (req, res) => {
  const { username, lock } = req.body;
  if (!req.user.is_admin) return res.status(403).json({ error: "Không có quyền" });

  console.log(`🔧 Admin lock request: ${username}, lock=${lock}`);
  db.run(
    `UPDATE users SET is_locked = ? WHERE username = ?`,
    [lock ? 1 : 0, username],
    function (err) {
      if (err) {
        console.error("🔥 SQL Error (lock):", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    }
  );
});

// ✅ Lấy tin nhắn
app.get("/api/messages", (req, res) => {
  db.all(`SELECT * FROM messages ORDER BY id DESC LIMIT 50`, (err, rows) => {
    if (err) {
      console.error("🔥 SQL Error (messages):", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows.reverse());
  });
});

// ✅ Socket chat
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("sendMessage", (msg) => {
    const { display_name, text } = msg;
    if (!text?.trim()) return;

    db.run(
      `INSERT INTO messages (display_name, text) VALUES (?, ?)`,
      [display_name, text],
      (err) => {
        if (err) {
          console.error("🔥 SQL Error (sendMessage):", err.message);
        } else {
          io.emit("newMessage", {
            display_name,
            text,
            created_at: new Date().toISOString(),
          });
        }
      }
    );
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// ✅ Build React nếu có
const clientPath = path.join(__dirname, "../client/build");
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));
  app.get("*", (req, res) => res.sendFile(path.join(clientPath, "index.html")));
} else {
  app.get("/", (req, res) => res.send("💬 Chat server is running!"));
}

// ✅ Start
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
