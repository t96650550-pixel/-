import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Chat from './pages/Chat';
import Call from './pages/Call';
import { useAuth } from './auth';

function PrivateRoute({ children, minRole = 'user' }) {
  const { user } = useAuth();
  const roles = ['user','manager','admin','superadmin'];
  if (!user) return <Navigate to="/login" />;
  if (roles.indexOf(user.role) < roles.indexOf(minRole)) return <div className="container app-card">Forbidden</div>;
  return children;
}

export default function App(){
  return (
    <>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/chat" element={<PrivateRoute><Chat/></PrivateRoute>} />
          <Route path="/call" element={<PrivateRoute><Call/></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute minRole="admin"><Admin/></PrivateRoute>} />
          <Route path="/" element={<PrivateRoute><Dashboard/></PrivateRoute>} />
        </Routes>
      </div>
    </>
  );
}
