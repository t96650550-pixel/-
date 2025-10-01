import React, {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

export default function Register(){
  const [username, setUsername] = useState('');
  const [display, setDisplay] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    setErr('');
    try{
      const r = await API.post('/register', { username, password, display_name: display });
      localStorage.setItem('chat_token', r.data.token);
      localStorage.setItem('chat_user', JSON.stringify(r.data.user));
      nav('/chat');
    }catch(err){
      const code = err?.response?.data?.error;
      if (code === 'username_taken') setErr('Tên tài khoản đã tồn tại 😅');
      else setErr('Lỗi khi đăng ký — thử lại nhé.');
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <h2>Tạo tài khoản mới ✨</h2>
        <input placeholder="Tên tài khoản" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Tên hiển thị (tùy chọn)" value={display} onChange={e=>setDisplay(e.target.value)} />
        <input placeholder="Mật khẩu" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Đăng ký</button>
        {err && <div className="error">{err}</div>}
        <div className="muted">Đã có tài khoản? <a href="/login">Đăng nhập</a></div>
      </form>
    </div>
  );
}
