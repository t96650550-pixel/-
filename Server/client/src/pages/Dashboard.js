import React from 'react';
import { useAuth } from '../auth';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Dashboard(){
  const { user } = useAuth();
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="app-card">
      <h2>Xin chào, {user?.displayName || user?.username}</h2>
      <p className="small">Role: {user?.role}</p>
      <div className="card-grid" style={{marginTop:12}}>
        <div className="app-card">
          <h4>Chat & Video</h4>
          <p className="small">Chat nhóm, chat riêng, gọi video (demo skeleton)</p>
          <Link to="/chat" className="btn" style={{marginTop:8}}>Mở Chat</Link>
        </div>
        <div className="app-card">
          <h4>Admin tools</h4>
          <p className="small">Quản lý user (nếu bạn là admin)</p>
          { (user.role === 'admin' || user.role === 'superadmin') && <Link to="/admin" className="btn" style={{marginTop:8}}>Admin</Link> }
        </div>
      </div>
    </motion.div>
  );
}
