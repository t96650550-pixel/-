import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function App(){
  const [view, setView] = useState('login');
  const [access, setAccess] = useState(null);
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const [text, setText] = useState('');

  useEffect(()=> {
    if(access){
      // fetch profile
      axios.get(API + '/api/me', { headers: { Authorization: 'Bearer ' + access } })
        .then(r=> setMe(r.data.user)).catch(()=>{});
      // connect socket
      socketRef.current = io(API, { auth: { token: access }});
      socketRef.current.on('connect_error', (err)=> console.error('sockerr', err));
      socketRef.current.on('new_message', (m)=> setMessages(prev=>[...prev, m]));
      return ()=> socketRef.current?.disconnect();
    }
  },[access]);

  useEffect(()=> {
    // load last messages
    axios.get(API + '/api/messages').then(r=> setMessages(r.data.messages)).catch(()=>{});
  },[]);

  const login = async (email, password) => {
    try{
      const r = await axios.post(API + '/api/login', { email, password }, { withCredentials:true });
      setAccess(r.data.access);
      setView('chat');
    }catch(e){ alert('login failed'); }
  };

  const register = async (email, username, password) => {
    try{
      await axios.post(API + '/api/register', { email, username, password });
      alert('registered - please login');
      setView('login');
    }catch(e){ alert('register failed'); }
  };

  const send = () => {
    if(!text) return;
    socketRef.current.emit('send_message', { text });
    setText('');
  };

  if(view === 'login') return <Auth onLogin={login} onGotoRegister={()=>setView('register')} onReset={()=>setView('reset')} />;
  if(view === 'register') return <Reg onRegister={register} onBack={()=>setView('login')} />;
  if(view === 'reset') return <Reset onBack={()=>setView('login')} />;

  return (
    <div style={{ padding:20, fontFamily:'Arial'}}>
      <h3>Chat — {me?.username || '...'}</h3>
      <div style={{height:300, overflow:'auto', border:'1px solid #ddd', padding:10}}>
        {messages.map((m,idx)=> <div key={idx}><b>{m.from_username}</b>: {m.content}</div>)}
      </div>
      <div style={{marginTop:10}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="message" />
        <button onClick={send}>Send</button>
      </div>
      <div style={{marginTop:10}}>
        <button onClick={async ()=>{ await axios.post(API + '/api/logout'); setAccess(null); setView('login'); }}>Logout</button>
      </div>
    </div>
  );
}

function Auth({ onLogin, onGotoRegister, onReset }){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{padding:20}}>
      <h3>Login</h3>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /><br/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><br/>
      <button onClick={()=>onLogin(email,password)}>Login</button>
      <button onClick={onGotoRegister}>Register</button>
    </div>
  );
}

function Reg({ onRegister, onBack }){
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{padding:20}}>
      <h3>Register</h3>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /><br/>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} /><br/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><br/>
      <button onClick={()=>onRegister(email,username,password)}>Create</button>
      <button onClick={onBack}>Back</button>
    </div>
  );
}

function Reset({ onBack }){
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const call = async () => {
    try{
      const r = await (await fetch((process.env.API_URL || 'http://localhost:3000') + '/api/request-reset',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) })).json();
      if(r.link) setLink(r.link);
    }catch(e){ alert('fail'); }
  };
  return (
    <div style={{padding:20}}>
      <h3>Request password reset</h3>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} /><br/>
      <button onClick={call}>Request</button>
      <div>{link && <div>Dev link: <a href={link}>{link}</a></div>}</div>
      <button onClick={onBack}>Back</button>
    </div>
  );
}
