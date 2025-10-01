import React, {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

export default function Login(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    setErr('');
    try{
      const r = await API.post('/login', { username, password });
      localStorage.setItem('chat_token', r.data.token);
      localStorage.setItem('chat_user', JSON.stringify(r.data.user));
      nav('/chat');
    }catch(err){
      const code = err?.response?.data?.error;
      if (code === 'invalid_credentials') setErr('Tên tài khoản hoặc mật khẩu không đúng 😿');
      else setErr('Lỗi khi đăng nhập — thử lại nhé.');
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Chào mừng trở lại ✧</h2>
        <input placeholder="Tên tài khoản" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Mật khẩu" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Đăng nhập</button>
        {err && <div className="error">{err}</div>}
        <div className="muted">Chưa có tài khoản? <a href="/register">Đăng ký</a></div>
      </form>
    </div>
  );
}
