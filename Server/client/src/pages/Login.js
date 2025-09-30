import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, api } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/auth/login', { username, password });
      login(r.data.token, r.data.user);
      nav('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="app-card" style={{maxWidth:420, margin:'40px auto'}}>
      <h2>Đăng nhập</h2>
      <form onSubmit={submit}>
        <input className="input" placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="input" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Đăng nhập</button>
      </form>

      <div style={{marginTop:12}}>
        <button className="input" onClick={()=> window.location = (process.env.REACT_APP_API || 'http://localhost:4000') + '/auth/google'}>Đăng nhập với Google</button>
        <button className="input" onClick={()=> window.location = (process.env.REACT_APP_API || 'http://localhost:4000') + '/auth/facebook'}>Đăng nhập với Facebook</button>
      </div>
      <div className="small">Nếu quên pass, hỏi admin để reset (demo).</div>
    </div>
  );
}
