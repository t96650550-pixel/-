import React, {useState} from 'react';
import axios from 'axios';
const API = process.env.REACT_APP_API || 'http://localhost:3001';

export default function Register({onLogin}){
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [displayName,setDisplayName] = useState('');
  const [err,setErr] = useState('');

  async function submit(e){
    e.preventDefault();
    try{
      const r = await axios.post(API + '/api/register', { username, password, display_name: displayName });
      onLogin(r.data);
    }catch(e){
      setErr(e.response?.data?.error || 'Error');
    }
  }
  return (
    <form onSubmit={submit}>
      <h3>Đăng ký</h3>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} required />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <input placeholder="tên hiển thị" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
      <button type="submit">Đăng ký</button>
      <div style={{color:'red'}}>{err}</div>
    </form>
  );
}
