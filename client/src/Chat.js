import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API = process.env.REACT_APP_API || 'http://localhost:3001';

export default function Chat({ token, user, onLogout }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    axios.get(API + '/api/messages').then(r => setMessages(r.data));
    axios.get(API + '/api/users').then(r => setUsers(r.data));

    const s = io(API, { auth: { token } });
    s.on('connect', () => console.log('connected'));
    s.on('message', m => setMessages(prev => [...prev, m]));
    s.on('error_message', msg => alert(msg));

    // nhận typing
    s.on('typing', ({ user: u }) => {
      if (u !== user.display_name) {
        setTypingUsers(prev => prev.includes(u) ? prev : [...prev, u]);
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(x => x !== u));
        }, 2000);
      }
    });

    setSocket(s);
    return () => s.disconnect();
  }, [token, user.display_name]);

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('send_message', text);
    setText('');
  }

  function handleTyping(e) {
    setText(e.target.value);
    if (socket) socket.emit('typing');
  }

  async function toggleLock(u) {
    await axios.post(API + '/api/admin/toggle-lock',
      { userId: u.id, lock: !u.is_locked },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const r = await axios.get(API + '/api/users');
    setUsers(r.data);
  }

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>Xin chào, {user.display_name} {user.is_admin ? '(Admin)' : ''}</div>
        <button onClick={onLogout} className="btn-logout">Đăng xuất</button>
      </div>

      <div className="chat-body">
        {/* Tin nhắn */}
        <div className="chat-messages">
          {messages.map(m => (
            <div
              key={m.id}
              className={`chat-message ${m.display_name === user.display_name ? 'me' : 'other'}`}
            >
              <span className="chat-bubble">
                <b>{m.display_name}: </b>{m.text}
              </span>
            </div>
          ))}

          {typingUsers.length > 0 && (
            <div className="chat-message other">
              <span className="chat-bubble typing">
                {typingUsers.join(', ')} đang gõ...
              </span>
            </div>
          )}
        </div>

        {/* Danh sách user */}
        <div className="chat-users">
          <h4>Người dùng</h4>
          {users.map(u => (
            <div key={u.id} className="user-item">
              {u.display_name} {u.is_admin ? '(A)' : ''}
              {user.is_admin && !u.is_admin && (
                <button
                  onClick={() => toggleLock(u)}
                  className={`btn-lock ${u.is_locked ? 'unlock' : 'lock'}`}
                >
                  {u.is_locked ? 'Mở khóa' : 'Khóa'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="chat-footer">
        <input
          className="chat-input"
          placeholder="Nhập tin nhắn..."
          value={text}
          onChange={handleTyping}
        />
        <button type="submit" className="btn-send">Gửi</button>
      </form>
    </div>
  );
}
