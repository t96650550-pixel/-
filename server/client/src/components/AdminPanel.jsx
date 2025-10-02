import React, {useState} from 'react';
import { API } from '../api';

export default function AdminPanel({ token }){
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState('temp');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    try{
      const res = await API('/api/admin/lock', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ username, mode, reason })
      });
      setMsg('OK');
    }catch(e){ setMsg(e?.error || 'err'); }
  };

  return (
    <div style={{marginTop:16}}>
      <h4>Admin Panel</h4>
      <input className="input" placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
      <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
        <option value="temp">Khóa tạm</option>
        <option value="permanent">Khóa vĩnh viễn</option>
        <option value="unlock">Mở khóa</option>
      </select>
      <input className="input" placeholder="Lý do (tuỳ chọn)" value={reason} onChange={e=>setReason(e.target.value)} />
      <button className="btn" onClick={submit}>Gửi</button>
      {msg && <div style={{marginTop:8}}>{msg}</div>}
    </div>
  );
}
