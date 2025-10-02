import React, {useEffect, useState, useRef} from 'react';
import MessageInput from './MessageInput';
import Message from './Message';
import AdminPanel from './AdminPanel';
import { API } from '../api';

export default function ChatWindow({ token, user, socket, onLogout }){
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(null);
  const messagesRef = useRef();

  useEffect(()=>{
    API('/api/messages').then(setMessages).catch(()=>{});
  },[]);

  useEffect(()=> {
    if (!socket) return;
    socket.on('message', (m) => { setMessages(prev => [...prev, m]); scrollBottom(); });
    socket.on('recall', ({id}) => { setMessages(prev => prev.map(p => p.id===id ? {...p, recalled:1} : p)); });
    socket.on('typing', ({username}) => { setTyping(username); setTimeout(()=>setTyping(null),2000); });
    return ()=> {
      socket.off('message'); socket.off('recall'); socket.off('typing');
    };
  }, [socket]);

  const scrollBottom = () => { setTimeout(()=>{ messagesRef.current?.scrollTo({top: messagesRef.current.scrollHeight, behavior:'smooth'}); }, 80); }

  const sendText = (text) => {
    if (!socket) return;
    socket.emit('sendMessage', { type:'text', content: text });
  };

  const sendVoiceFile = async (file) => {
    try{
      const fd = new FormData();
      fd.append('voice', file);
      const res = await fetch('/api/voice', { method:'POST', headers: { Authorization: 'Bearer '+token }, body: fd });
      // server will emit message to socket, so no need to push locally
    }catch(e){ console.error(e); }
  };

  const recall = async (id) => {
    // prefer socket recall
    if (socket) socket.emit('recallMessage', { id });
    else {
      await API('/api/recall', { method:'POST', headers: { 'Content-Type':'application/json','Authorization':'Bearer '+token }, body: JSON.stringify({ messageId: id })});
    }
  };

  return (
    <div className="card chat-wrap">
      <div className="sidebar card">
        <h3>Người dùng</h3>
        <div style={{marginTop:10}}>Bạn: <strong>{user.displayName || user.username}</strong></div>
        <div style={{marginTop:10}}>
          <button className="btn" onClick={onLogout}>Đăng xuất</button>
        </div>
        {user.role === 'admin' && <AdminPanel token={token} />}
      </div>

      <div className="main card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h2>Phòng chung</h2>
          <div className="small">{typing ? `${typing} đang gõ...` : ''}</div>
        </div>

        <div ref={messagesRef} className="messages" style={{minHeight:380}}>
          {messages.map(m => <Message key={m.id} msg={m} me={m.userId === user.id} onRecall={()=>recall(m.id)} />)}
        </div>

        <MessageInput onSend={sendText} onSendVoice={sendVoiceFile} socket={socket} token={token} />
      </div>
    </div>
  );
}
