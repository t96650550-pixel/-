import React, {useEffect, useState, useRef} from 'react';
import io from 'socket.io-client';
import AuthForm from './components/AuthForm';
import ChatWindow from './components/ChatWindow';
const SERVER = import.meta.env.VITE_API_BASE || '';

function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')||'null'));
  const [socket, setSocket] = useState(null);

  useEffect(()=> {
    if (token && !socket) {
      const s = io('/', { auth: { token } });
      s.on('connect_error', (e)=> console.error('socket error', e));
      s.on('connected', ({user}) => console.log('connected as', user));
      setSocket(s);
      return ()=> s.disconnect();
    }
    if (!token && socket) { socket.disconnect(); setSocket(null); }
  }, [token]);

  const onLogin = ({token, user})=>{
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token); setUser(user);
  };
  const onLogout = ()=>{
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setToken(null); setUser(null);
    if (socket) { socket.disconnect(); setSocket(null); }
  };

  return (
    <div className="app-root">
      <div className="bg-orb"></div>
      <div className="container">
        {!token ? <AuthForm onAuth={onLogin} />
        : <ChatWindow token={token} user={user} socket={socket} onLogout={onLogout} />}
      </div>
      <footer className="footer">GlowChat • Beautiful realtime chat</footer>
    </div>
  );
}

export default App;
