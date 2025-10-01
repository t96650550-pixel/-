// Chat.js
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';
import { io } from 'socket.io-client';
import api from '../api';

export default function Chat() {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [room] = useState('global');
  const messagesRef = useRef();

  useEffect(() => {
    if (!token) return;
    const s = io(process.env.REACT_APP_SOCKET || process.env.REACT_APP_API || '', {
      auth: { token }
    });

    s.on('connect', () => console.log('socket connected', s.id));

    s.on('message', (m) => {
      setMessages(prev => [...prev, m]);
    });

    s.on('recalled', ({ id }) => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, recalled: true } : m));
    });

    setSocket(s);
    s.emit('join_room', { room: 'global' });

    return () => s.disconnect();
  }, [token]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    if (!socket || !text.trim()) return;
    socket.emit('message', { room, content: text });
    setText('');
  };

  const recall = async (id) => {
    try {
      await api.post('/chat/recall', { id });
    } catch (e) {
      alert(e.response?.data?.error || 'Không thể thu hồi');
    }
  };

  return (
    <div className="app-card">
      <h3>💬 Chat — Phòng: {room}</h3>
      <div 
        ref={messagesRef} 
        style={{ height: 320, overflow: 'auto', border: '1px solid #eee', padding: 8 }}
      >
        {messages.map((m, i) => {
          const from = m.fromDisplayName || m.from || 'Người dùng';
          const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';
          
          return (
            <div key={m.id || i} style={{ marginBottom: 8 }}>
              <b>{from}</b>:{' '}
              {m.recalled ? (
                <i>(Tin nhắn đã bị thu hồi)</i>
              ) : (
                <span>{m.content}</span>
              )}
              <span className="small" style={{ marginLeft: 8 }}>{time}</span>

              {/* Nút thu hồi: chỉ hiện nếu là chủ tin nhắn hoặc admin */}
              {!m.recalled && 
                (user?.role === 'admin' || user?.id === m.from) && (
                  <button 
                    style={{ marginLeft: 8, fontSize: 12 }}
                    onClick={() => recall(m.id)}
                  >
                    Thu hồi
                  </button>
                )
              }
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
