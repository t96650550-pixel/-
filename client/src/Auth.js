import React, { useState } from "react";
import axios from "axios";
import "./auth.css";

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? "/login" : "/register";
      const data = isLogin ? { username, password } : { username, password, display_name: displayName };
      const res = await axios.post(endpoint, data);

      if (isLogin) {
        localStorage.setItem("token", res.data.token);
        onLogin(res.data.user);
      } else {
        setMessage("🎉 Đăng ký thành công! Hãy đăng nhập nhé~");
        setIsLogin(true);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "❌ Lỗi server rồi...");
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit}>
        <h2>{isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}</h2>
        <input
          type="text"
          placeholder="Tên đăng nhập"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        {!isLogin && (
          <input
            type="text"
            placeholder="Tên hiển thị"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        )}
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{isLogin ? "Đăng nhập" : "Đăng ký"}</button>
        <p onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Chưa có tài khoản? Đăng ký ngay!" : "Đã có tài khoản? Đăng nhập"}
        </p>
        {message && <div className="message">{message}</div>}
      </form>
    </div>
  );
}
