// simplified chat UI
import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

export default function Chat({ token }) {
  const [messages,setMessages] = useState([]);
  const [input,setInput] = useState('');
  const socketRef = useRef(null);

  useEffect(()=>{
    const s = io(process.env.REACT_APP_API_URL || 'http://localhost:4000', {
      auth: { token }
    });
    socketRef.current = s;
    s.on('connect_error', (err) => { console.error(err); });
    s.on('history', (hist) => setMessages(hist));
    s.on('newMessage', m => setMessages(prev => [...prev, m]));
    s.on('actionDenied', d => alert(d.reason));
    return ()=> s.disconnect();
  }, [token]);

  const send = () => {
    if(!input.trim()) return;
    socketRef.current.emit('sendMessage', { content: input });
    setInput('');
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#0f1724',color:'#e2e8f0',padding:16}}>
      <div style={{flex:1,overflow:'auto',padding:12}}>
        {messages.map(m => (
          <div key={m.id} style={{marginBottom:8,opacity: m.deleted?0.5:1}}>
            <b style={{color:'#60a5fa'}}>{m.username}</b> <small style={{color:'#94a3b8'}}>{new Date(m.created_at).toLocaleTimeString()}</small>
            <div style={{background:'#111827',padding:8,borderRadius:8,display:'inline-block',marginTop:4}}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Gõ gì đó dễ thương nè..." style={{flex:1,padding:12,borderRadius:10,border:'none'}} />
        <button onClick={send} style={{padding:'12px 16px',borderRadius:10,background:'#60a5fa',border:'none'}}>Gửi</button>
      </div>
    </div>
  );
}
