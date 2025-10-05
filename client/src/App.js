import React, { useState } from "react";
import axios from "axios";
import Chat from "./Chat";
import "./auth.css";

const API_BASE = process.env.REACT_APP_API_URL || "https://your-render-server-url.onrender.com";

export default function App() {
  const [mode, setMode] = useState("login"); // login hoặc register
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (mode === "login") {
        const res = await axios.post(`${API_BASE}/api/login`, { username, password });
        localStorage.setItem("token", res.data.token);
        setUser(res.data.user);
      } else {
        const res = await axios.post(`${API_BASE}/api/register`, {
          username,
          password,
          display_name: displayName,
        });
        localStorage.setItem("token", res.data.token);
        setUser(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi rồi, thử lại nha 💔");
    }
  }

  if (user) return <Chat user={user} token={localStorage.getItem("token")} />;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h2>
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <input
              type="text"
              placeholder="Tên hiển thị ✨"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            type="text"
            placeholder="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error">{error}</div>}
          <button type="submit">
            {mode === "login" ? "Vào chat 💬" : "Tạo tài khoản ✨"}
          </button>
        </form>

        <p className="switch-mode">
          {mode === "login" ? (
            <>
              Chưa có tài khoản?{" "}
              <span onClick={() => setMode("register")}>Đăng ký liền nè</span>
            </>
          ) : (
            <>
              Đã có tài khoản?{" "}
              <span onClick={() => setMode("login")}>Đăng nhập ngay</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
