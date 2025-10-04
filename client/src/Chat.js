import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:3001';

export default function Chat({ token, user, onLogout }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    // load messages + users ban đầu
    axios.get(API + '/api/messages').then(r => setMessages(r.data));
    axios.get(API + '/api/users').then(r => setUsers(r.data));

    const s = io(API, {
      auth: { token }
    });
    s.on('connect', () => console.log('connected'));
    s.on('message', m => setMessages(prev => [...prev, m]));
    s.on('error_message', msg => alert(msg));

    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('send_message', text);
    setText('');
  }

  async function toggleLock(u) {
    await axios.post(API + '/api/admin/toggle-lock',
      { userId: u.id, lock: !u.is_locked },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // reload user list
    const r = await axios.get(API + '/api/users');
    setUsers(r.data);
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'80vh'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'#5561ff',color:'white'}}>
        <div>Xin chào, {user.display_name} {user.is_admin ? '(Admin)' : ''}</div>
        <button onClick={onLogout} style={{background:'white',color:'#5561ff',borderRadius:5}}>Đăng xuất</button>
      </div>

      <div style={{flex:1,display:'flex'}}>
        {/* Chat box */}
        <div style={{flex:2,borderRight:'1px solid #ccc',padding:10,overflowY:'auto'}}>
          {messages.map(m=>(
            <div key={m.id} style={{marginBottom:8}}>
              <b>{m.display_name}:</b> {m.text}
            </div>
          ))}
        </div>

        {/* User list + admin panel */}
        <div style={{flex:1,padding:10,overflowY:'auto'}}>
          <h4>Người dùng</h4>
          {users.map(u=>(
            <div key={u.id} style={{marginBottom:6}}>
              {u.display_name} {u.is_admin ? '(A)' : ''}
              {user.is_admin && !u.is_admin && (
                <button 
                  onClick={()=>toggleLock(u)}
                  style={{marginLeft:10,background:u.is_locked?'green':'red',color:'white'}}
                >
                  {u.is_locked ? 'Mở khóa' : 'Khóa'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={sendMessage} style={{display:'flex',padding:10,borderTop:'1px solid #ccc'}}>
        <input style={{flex:1,padding:10}} placeholder="Nhập tin nhắn..." value={text} onChange={e=>setText(e.target.value)} />
        <button type="submit" style={{marginLeft:10}}>Gửi</button>
      </form>
    </div>
  );
}
