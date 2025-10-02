import React, {useState} from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Login(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    try{
      const res = await axios.post('/api/login', {username, password});
      localStorage.setItem('token', res.data.token);
      nav('/');
    }catch(err){
      alert(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-300 to-indigo-200">
      <form onSubmit={submit} className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Chào cưng ✨ Đăng nhập</h1>
        <input className="w-full p-3 rounded-md mb-3 border" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="w-full p-3 rounded-md mb-4 border" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:opacity-90">Đăng nhập</button>
        <div className="text-sm mt-3 text-center">
          <Link to="/register" className="text-indigo-700">Tạo tài khoản mới</Link>
        </div>
      </form>
    </div>
  );
}