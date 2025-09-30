import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { io } from 'socket.io-client';

export default function Chat(){
  const { token, api } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(()=> {
    if (!token) return;
    const s = io(process.env.REACT_APP_SOCKET || (process.env.REACT_APP_API || 'http://localhost:4000'), { auth: { token }});
    s.on('connect', ()=> console.log('socket connected', s.id));
    s.on('message', (m) => setMessages(prev => [...prev, m]));
    setSocket(s);
    return () => s.disconnect();
  }, [token]);

  const send = () => {
    if (!socket) return;
    socket.emit('message', { content: text });
    setText('');
  };

  return (
    <div className="app-card">
      <h3>Chat demo</h3>
      <div style={{height:300, overflow:'auto', border:'1px solid #eee', padding:8}}>
        {messages.map((m,i)=> <div key={i}><b>{m.from}</b>: {m.content}</div>)}
      </div>
      <div style={{marginTop:8}}>
        <input className="input" value={text} onChange={e=>setText(e.target.value)} />
        <button className="btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
