import React, {useState} from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

export default function Register(){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [display,setDisplay]=useState('');
  const [avatar,setAvatar]=useState(null);
  const nav = useNavigate();

  async function submit(e){
    e.preventDefault();
    const fd = new FormData();
    fd.append('username', username);
    fd.append('password', password);
    fd.append('display_name', display);
    if(avatar) fd.append('avatar', avatar);
    try{
      const res = await axios.post('/api/register', fd, { headers: {'Content-Type':'multipart/form-data'}});
      localStorage.setItem('token', res.data.token);
      nav('/');
    }catch(err){
      alert(err.response?.data?.error || 'Register failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-200 to-yellow-200">
      <form onSubmit={submit} className="bg-white/90 p-8 rounded-2xl shadow-md w-96">
        <h1 className="text-2xl font-bold mb-4 text-center">Đăng ký dễ thương 💖</h1>
        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 rounded-md mb-3 border" placeholder="Username" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 rounded-md mb-3 border" placeholder="Password" />
        <input value={display} onChange={e=>setDisplay(e.target.value)} className="w-full p-3 rounded-md mb-3 border" placeholder="Tên hiển thị (tùy)" />
        <input type="file" onChange={e=>setAvatar(e.target.files[0])} className="mb-4" />
        <button className="w-full py-3 rounded-xl bg-pink-500 text-white font-semibold hover:opacity-95">Tạo tài khoản</button>
        <div className="text-sm mt-3 text-center">
          <Link to="/login" className="text-pink-700">Đã có tài khoản? Đăng nhập</Link>
        </div>
      </form>
    </div>
  );
}