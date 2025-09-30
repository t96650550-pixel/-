import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function NavBar(){
  const { user, logout } = useAuth();
  return (
    <div className="nav container">
      <div><Link to="/">iSchool-LMS Demo</Link></div>
      <div>
        {user ? (
          <>
            <Link to="/">Dashboard</Link>
            <Link to="/chat">Chat</Link>
            { (user.role === 'admin' || user.role === 'superadmin') && <Link to="/admin">Admin</Link> }
            <button onClick={logout} className="btn" style={{marginLeft:12}}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}
