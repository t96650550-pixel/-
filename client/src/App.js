import React, {useState, useEffect} from 'react';
import Login from './Login';
import Register from './Register';
import Chat from './Chat';

export default function App(){
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')||'null'));

  function onLogin(data){
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  function onLogout(){
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return (
    <div style={{fontFamily:'Inter, sans-serif',display:'flex',justifyContent:'center',padding:20}}>
      <div style={{width:900,boxShadow:'0 10px 30px rgba(0,0,0,0.12)',borderRadius:12,overflow:'hidden'}}>
        {!token ? (
          <div style={{display:'flex'}}>
            <div style={{flex:1,padding:30,background:'#f7f9ff'}}>
              <h2>Welcome ✨</h2>
              <p>Chat realtime, đăng ký hoặc đăng nhập đi nè.</p>
            </div>
            <div style={{flex:1,padding:20}}>
              <Login onLogin={onLogin}/>
              <hr/>
              <Register onLogin={onLogin}/>
            </div>
          </div>
        ) : (
          <Chat token={token} user={user} onLogout={onLogout}/>
        )}
      </div>
    </div>
  );
}
