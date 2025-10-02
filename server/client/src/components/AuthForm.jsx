import React, {useState} from 'react';
import { API } from '../api';

export default function AuthForm({ onAuth }){
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err,setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try{
      const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await API(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, password, displayName })
      });
      onAuth(res);
    }catch(e){ setErr(e?.error || 'Lỗi'); }
  };

  return (
    <div className="card auth">
      <div className="logo"><span className="dot"></span>GlowChat</div>
      <form onSubmit={submit}>
        <input className="input" placeholder="Tài khoản" value={username} onChange={e=>setUsername(e.target.value)} />
        <input className="input" type="password" placeholder="Mật khẩu" value={password} onChange={e=>setPassword(e.target.value)} />
        {mode==='register' && <input className="input" placeholder="Tên hiển thị (tùy chọn)" value={displayName} onChange={e=>setDisplayName(e.target.value)} />}
        <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',marginTop:8}}>
          <button className="btn" type="submit">{mode==='login' ? 'Đăng nhập' : 'Đăng ký'}</button>
          <div style={{textAlign:'right'}}>
            <button type="button" className="small" onClick={()=>setMode(mode==='login' ? 'register' : 'login')}>{mode==='login' ? 'Tạo tài khoản' : 'Đã có tài khoản'}</button>
          </div>
        </div>
        {err && <div style={{color:'#ffb4b4',marginTop:8}}>{err}</div>}
      </form>
      <div style={{marginTop:12,fontSize:12,opacity:0.8}}>Ghi chú: bản demo hỗ trợ gửi văn bản & ghi âm, admin có thể khóa tài khoản.</div>
    </div>
  );
}
