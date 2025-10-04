import React, {useState} from 'react';
import axios from 'axios';
const API = process.env.REACT_APP_API || 'http://localhost:3001';

export default function Login({onLogin}){
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [err,setErr] = useState('');

  async function submit(e){
    e.preventDefault();
    try{
      const r = await axios.post(API + '/api/login', { username, password });
      onLogin(r.data);
    }catch(e){
      setErr(e.response?.data?.error || 'Error');
    }
  }
  return (
    <form onSubmit={submit}>
      <h3>Đăng nhập</h3>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} required />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <button type="submit">Đăng nhập</button>
      <div style={{color:'red'}}>{err}</div>
    </form>
  );
}
