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
  const [room, setRoom] = useState('global');
  const messagesRef = useRef();

  useEffect(() => {
    if (!token) return;
    const s = io(process.env.REACT_APP_SOCKET || (process.env.REACT_APP_API || ''), {
      auth: { token }
    });
    s.on('connect', () => console.log('socket connected', s.id));

    s.on('message', (m) => setMessages(prev => [...prev, m]));
    s.on('message_recalled', (id) => {
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, content: '[Tin nhắn đã thu hồi]' } : m)
      );
    });

    setSocket(s);
    s.emit('join_room', { room: 'global' });
    return () => s.disconnect();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api.get(`/chat/${room}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMessages(res.data))
      .catch(err => console.error(err));
  }, [room, token]);

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
      await api.post(`/chat/${room}/recall/${id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, content: '[Tin nhắn đã thu hồi]' } : m)
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Thu hồi thất bại');
    }
  };

  return (
    <div className="app-card">
      <h3>Chat — Phòng: {room}</h3>
      <div 
        ref={messagesRef} 
        style={{
          height: 320, 
          overflow: 'auto', 
          border: '1px solid #eee', 
          padding: 8,
          background: '#fafafa'
        }}
      >
        {messages.map((m, i) => {
          const isMyMsg = m.from === user.username;
          const canRecall =
            (isMyMsg && Date.now() - new Date(m.created_at).getTime() < 5 * 60 * 1000) ||
            user.role === 'admin';

          return (
            <div 
              key={m.id || i} 
              style={{ 
                marginBottom: 10, 
                padding: 6, 
                borderRadius: 6,
                background: isMyMsg ? '#d1f7c4' : '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <b>{m.fromDisplayName || m.from}</b>: {m.content}
                <span className="small" style={{ marginLeft: 8, fontSize: '0.8em', color: '#666' }}>
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
              </div>
              {canRecall && m.content !== '[Tin nhắn đã thu hồi]' && (
                <button
                  onClick={() => recall(m.id)}
                  style={{ 
                    marginLeft: 10, 
                    fontSize: '0.7em', 
                    color: '#fff',
                    background: '#ff6b6b',
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 6px',
                    cursor: 'pointer'
                  }}
                >
                  Thu hồi
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
