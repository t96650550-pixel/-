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
    <div className="app-card" style={{ maxWidth: 600, margin: "20px auto" }}>
      <h3 style={{ marginBottom: 10 }}>💬 Chat — Phòng: {room}</h3>

      <div
        ref={messagesRef}
        style={{
          height: 350,
          overflowY: 'auto',
          border: '1px solid #ddd',
          padding: 10,
          borderRadius: 6,
          background: '#f9f9f9'
        }}
      >
        {messages.map((m, i) => {
          const isMyMsg = user && m.from === user.username;
          const canRecall =
            (isMyMsg && Date.now() - new Date(m.created_at || Date.now()).getTime() < 5 * 60 * 1000) ||
            (user && user.role === 'admin');

          return (
            <div
              key={m.id || i}
              style={{
                display: 'flex',
                justifyContent: isMyMsg ? 'flex-end' : 'flex-start',
                marginBottom: 10
              }}
            >
              <div
                style={{
                  background: isMyMsg ? '#d1f7c4' : '#fff',
                  padding: '6px 10px',
                  borderRadius: 6,
                  maxWidth: '70%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '0.85em', marginBottom: 2 }}>
                  <b>{m.fromDisplayName || m.from || 'Ẩn danh'}</b>
                </div>
                <div>{m.content}</div>
                <div style={{ fontSize: '0.7em', color: '#666', marginTop: 4 }}>
                  {new Date(m.created_at || Date.now()).toLocaleTimeString()}
                </div>

                {canRecall && m.content !== '[Tin nhắn đã thu hồi]' && (
                  <button
                    onClick={() => recall(m.id)}
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: -65,
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
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Nhập tin nhắn..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="btn" onClick={send}>Gửi</button>
      </div>
    </div>
  );
}
