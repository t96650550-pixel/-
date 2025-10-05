import React, { useState, useEffect } from 'react';
import Auth from './Auth';
import Chat from './Chat';

export default function App(){
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('chat_user');
    return s ? JSON.parse(s) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('chat_token') || '');

  useEffect(()=>{
    if(user && token){
      localStorage.setItem('chat_user', JSON.stringify(user));
      localStorage.setItem('chat_token', token);
    } else {
      localStorage.removeItem('chat_user');
      localStorage.removeItem('chat_token');
    }
  }, [user, token]);

  function handleAuth(u, t){
    setUser(u);
    setToken(t);
  }

  function handleLogout(){
    setUser(null);
    setToken('');
  }

  return (
    <div>
      {!user ? (
        <Auth onAuth={handleAuth} />
      ) : (
        <Chat user={user} token={token} onLogout={handleLogout} />
      )}
    </div>
  );
}
