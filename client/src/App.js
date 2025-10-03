// client/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';

function App(){
  const [token,setToken] = useState(localStorage.getItem('token'));
  useEffect(()=> {
    if(token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  },[token]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={ token ? <Chat token={token}/> : <Navigate to="/login" /> } />
        <Route path="/admin" element={ token ? <AdminPanel token={token}/> : <Navigate to="/login" /> } />
        <Route path="*" element={<Navigate to="/chat" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
