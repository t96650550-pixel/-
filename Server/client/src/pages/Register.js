// Register.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Register(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const { api } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { 
        username, 
        password, 
        email, 
        displayName: username 
      });
      alert('🎉 Đăng ký thành công! Vui lòng kiểm tra email để xác thực (nếu có).');
      nav('/login');
    } catch (err) {
      alert(err.response?.data?.error || 'Register failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="app-card" style={{maxWidth:420, margin:'40px auto'}}>
      <h2>Đăng ký</h2>
      <form onSubmit={submit}>
        <input className="input" placeholder="Tên đăng nhập" value={username} onChange={e=>setUsername(e.target.value)} required />
        <input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Mật khẩu" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="btn" type="submit" disabled={loading}>{ loading ? 'Đang xử lý...' : 'Đăng ký' }</button>
      </form>
    </div>
  );
}
