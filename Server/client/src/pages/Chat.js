// Chat.js
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { io } from 'socket.io-client';
import api from '../api';

export default function Chat(){
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [room, setRoom] = useState('global');
  const messagesRef = useRef();

  useEffect(()=> {
    if (!token) return;
    const s = io(process.env.REACT_APP_SOCKET || (process.env.REACT_APP_API || ''), { auth: { token }});
    s.on('connect', ()=> console.log('socket connected', s.id));
    s.on('message', (m) => setMessages(prev => [...prev, m]));
    setSocket(s);
    s.emit('join_room', { room: 'global' });
    return () => s.disconnect();
  }, [token]);

  useEffect(()=> { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight; }, [messages]);

  const send = () => {
    if (!socket || !text.trim()) return;
    socket.emit('message', { room, content: text });
    setText('');
  };

  return (
    <div className="app-card">
      <h3>Chat — Phòng: {room}</h3>
      <div ref={messagesRef} style={{height:320, overflow:'auto', border:'1px solid #eee', padding:8}}>
        {messages.map((m,i)=> (
          <div key={i} style={{marginBottom:8}}>
            <b>{m.fromDisplayName || m.from}</b>: {m.content} <span className="small" style={{marginLeft:8}}>{new Date(m.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
      <div style={{marginTop:8, display:'flex', gap:8}}>
        <input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=> e.key==='Enter' && send()} />
        <button className="btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
