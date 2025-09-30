import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Register(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const { api } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { username, password, email, displayName: username });
      alert('Đăng ký thành công. Kiểm tra email để xác thực.');
      nav('/login');
    } catch (err) {
      alert(err.response?.data?.error || 'Register failed');
    }
  };

  return (
    <div className="app-card" style={{maxWidth:420, margin:'40px auto'}}>
      <h2>Đăng ký</h2>
      <form onSubmit={submit}>
        <input className="input" placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="input" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Đăng ký</button>
      </form>
    </div>
  );
}
