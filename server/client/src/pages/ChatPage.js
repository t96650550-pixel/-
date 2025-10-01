import React, {useEffect, useState, useRef} from 'react';
import { io } from 'socket.io-client';
import API from '../utils/api';

const SERVER = 'http://localhost:4000';

export default function ChatPage(){
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState('global');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const fileRef = useRef();
  const messageEndRef = useRef();
  const user = JSON.parse(localStorage.getItem('chat_user') || 'null');

  useEffect(()=>{
    const token = localStorage.getItem('chat_token');
    const s = io(SERVER, { auth: { token } });
    setSocket(s);
    s.on('connect', ()=>{ s.emit('join', room); });
    s.on('message', (m)=> setMessages(prev => [...prev, m]));
    s.on('user_list', (list) => setUsers(list));
    s.on('notification', n => {
      // small toast
      console.log('notif', n);
    });
    s.on('typing', (t)=>{/* could show typing UI */});
    return ()=> s.disconnect();
  }, []); // run once

  useEffect(()=> {
    if (!socket) return;
    socket.emit('join', room);
    API.get(`/messages/${room}`).then(r=> setMessages(r.data)).catch(()=>{});
  }, [socket, room]);

  useEffect(()=> { messageEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  function sendMessage(e){
    e?.preventDefault();
    if (!text && !file) return;
    if (file) {
      // upload file
      const fd = new FormData();
      fd.append('file', file);
      API.post('/upload', fd, { headers: {'Content-Type':'multipart/form-data'} })
        .then(r=>{
          const url = r.data.url;
          const type = file.type.startsWith('video') ? 'video' : 'image';
          socket.emit('send_message', { room, content: '', type, url });
          setFile(null); fileRef.current.value = '';
        }).catch(()=> alert('Upload lỗi'));
    }
    if (text) {
      socket.emit('send_message', { room, content: text, type: 'text' });
      setText('');
    }
  }

  function handleFileChange(e){
    setFile(e.target.files[0]);
  }

  function logout(){
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    window.location.href = '/login';
  }

  return (
    <div className="chat-page">
      <aside className="sidebar card">
        <div className="user-block">
          <div className="avatar">{user?.display_name?.charAt(0) || 'U'}</div>
          <div>
            <div className="name">{user?.display_name || user?.username}</div>
            <div className="small muted">{user?.username}</div>
          </div>
        </div>
        <hr/>
        <div className="rooms">
          <button className={room==='global'?'active':''} onClick={()=>setRoom('global')}>Phòng chính</button>
          <button className={room==='dev'?'active':''} onClick={()=>setRoom('dev')}>Dev</button>
        </div>
        <hr/>
        <div>
          <div className="muted small">Đang online</div>
          <ul className="user-list">
            {users.map((u, i)=> <li key={i}>{u.username}</li>)}
          </ul>
        </div>
        <button className="btn ghost" onClick={logout}>Đăng xuất</button>
      </aside>

      <main className="chat-main card">
        <div className="chat-header">
          <h3>{room}</h3>
          <div className="muted small">Bạn có thể gửi ảnh/video (<=50MB)</div>
        </div>
        <div className="messages" id="messages">
          {messages.map(m=> (
            <div className={`message ${m.sender_name===user?.username?'me':'them'}`} key={m.id} >
              <div className="meta">{m.sender_name} <span className="time muted">{new Date(m.created_at).toLocaleTimeString()}</span></div>
              {m.type==='text' && <div className="bubble">{m.content}</div>}
              {m.type==='image' && <img src={`http://localhost:4000${m.url}`} alt="img" className="media" />}
              {m.type==='video' && <video controls className="media"><source src={`http://localhost:4000${m.url}`} /></video>}
            </div>
          ))}
          <div ref={messageEndRef}></div>
        </div>

        <form className="composer" onSubmit={sendMessage}>
          <input type="text" placeholder="Nhập tin nhắn..." value={text} onChange={e=>setText(e.target.value)} />
          <input ref={fileRef} type="file" onChange={handleFileChange} />
          <button className="btn" type="submit">Gửi</button>
        </form>
      </main>
    </div>
  );
}
