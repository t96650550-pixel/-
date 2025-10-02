import React, {useEffect, useState, useRef} from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const API = '';

export default function Chat(){
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef();
  const token = localStorage.getItem('token');

  useEffect(()=>{
    axios.get('/api/me', { headers: { Authorization: `Bearer ${token}` }}).then(res=>setUser(res.data)).catch(()=>{ localStorage.removeItem('token'); window.location.reload(); });
    axios.get('/api/rooms', { headers: { Authorization: `Bearer ${token}` }}).then(res=>setRooms(res.data));
  },[]);

  useEffect(()=>{
    if(!user) return;
    const s = io({ auth: { token } });
    socketRef.current = s;
    s.on('connect_error', (err)=> console.error('socket err', err));
    s.on('new_message', (msg)=>{
      if(msg.room_id === currentRoom?.id) setMessages(prev=>[...prev, msg]);
    });
    s.on('message_retracted', ({messageId})=>{
      setMessages(prev => prev.map(m => m.id === messageId ? {...m, retracted:1} : m));
    });
    s.on('typing', ({userId, typing}) => {
      setTypingUsers(prev => ({ ...prev, [userId]: typing }));
    });
    s.on('presence_update', (p)=>{ /* update online list if you want */ });

    return ()=> s.disconnect();
  }, [user, currentRoom]);

  function joinRoom(room){
    setCurrentRoom(room);
    setMessages([]);
    // load last messages from server -- simple: query DB directly
    axios.get(`/api/rooms/${room.id}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res=> setMessages(res.data))
      .catch(()=>{ /* ignore */});
    socketRef.current.emit('join_room', {roomId: room.id});
  }

  function sendMessage(e){
    e?.preventDefault();
    if(!text.trim()) return;
    socketRef.current.emit('send_message', {roomId: currentRoom.id, content: text});
    setText('');
  }

  // typing indicator
  useEffect(()=>{
    const t = setTimeout(()=> socketRef.current?.emit('typing', {roomId: currentRoom?.id, typing: false}), 800);
    if(text.length > 0) socketRef.current?.emit('typing', {roomId: currentRoom?.id, typing: true});
    return ()=> clearTimeout(t);
  }, [text]);

  return (
    <div className="h-screen flex">
      {/* left column: rooms */}
      <div className="w-80 bg-white/80 border-r p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
            <img src={user?.avatar||'/default-avatar.png'} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-semibold">{user?.display_name}</div>
            <div className="text-sm text-gray-500">{user?.username}</div>
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-600">Phòng</h3>
        <div className="mt-3 space-y-2">
          {rooms.map(r => (
            <button key={r.id} onClick={()=>joinRoom(r)} className={`w-full text-left p-2 rounded-md ${currentRoom?.id===r.id ? 'bg-indigo-50' : 'hover:bg-gray-100'}`}>
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.created_at}</div>
            </button>
          ))}
        </div>
      </div>

      {/* main chat */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-white to-slate-50">
        <div className="flex-1 overflow-auto p-6" id="messages">
          {!currentRoom ? (
            <div className="text-center text-gray-500 mt-20">Chọn phòng để bắt đầu chat nha ~</div>
          ) : (
            messages.map(m => (
              <div key={m.id} className="mb-3">
                <div className="flex items-start gap-3">
                  <img src={m.avatar || '/default-avatar.png'} alt="" className="w-10 h-10 rounded-full"/>
                  <div>
                    <div className="text-sm font-semibold">{m.display_name}</div>
                    <div className="mt-1 p-3 rounded-xl bg-white shadow">{m.retracted ? <i>Tin nhắn đã thu hồi</i> : m.content}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t bg-white flex items-center gap-3">
          <div className="flex-1">
            <form onSubmit={sendMessage} className="flex gap-3">
              <input value={text} onChange={e=>setText(e.target.value)} placeholder="Gõ tin nhắn..." className="flex-1 p-3 rounded-full border" />
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-full">Gửi</button>
            </form>
            <div className="text-xs text-gray-500 mt-1">
              {Object.keys(typingUsers).filter(k=>typingUsers[k]).length ? 'Có người đang gõ...' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}