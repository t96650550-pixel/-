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

  // load lịch sử tin nhắn
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await api.get(`/messages?room=${room}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error('Load history fail', err);
      }
    })();
  }, [token, room]);

  // socket.io
  useEffect(() => {
    if (!token) return;
    const s = io(
      process.env.REACT_APP_SOCKET || process.env.REACT_APP_API || '',
      { auth: { token } }
    );
    s.on('connect', () => console.log('socket connected', s.id));
    s.on('message', (m) => setMessages(prev => [...prev, m]));
    s.on('message_revoked', (id) => {
      setMessages(prev => prev.filter(msg => msg.id !== id));
    });
    setSocket(s);
    s.emit('join_room', { room: 'global' });
    return () => s.disconnect();
  }, [token]);

  useEffect(() => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!socket || !text.trim()) return;
    socket.emit('message', { room, content: text });
    setText('');
  };

  const revoke = async (id) => {
    try {
      await api.post(`/messages/${id}/revoke`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(prev => prev.filter(msg => msg.id !== id));
    } catch (err) {
      alert('Thu hồi thất bại (có thể quá 5 phút hoặc lỗi)');
    }
  };

  return (
    <div className="app-card">
      <h3>Chat — Phòng: {room}</h3>
      <div
        ref={messagesRef}
        style={{ height: 320, overflow: 'auto', border: '1px solid #eee', padding: 8 }}
      >
        {messages.map((m, i) => (
          <div key={m.id || i} style={{ marginBottom: 8 }}>
            <b>{m.fromDisplayName || m.from}</b>: {m.content}
            <span className="small" style={{ marginLeft: 8 }}>
              {new Date(m.created_at).toLocaleTimeString()}
            </span>
            {m.from === user.id && (
              <button
                style={{ marginLeft: 8, color: 'red' }}
                onClick={() => revoke(m.id)}
              >
                Thu hồi
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn" onClick={send}>Send</button>
      </div>
    </div>
  );
}
