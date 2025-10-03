import React, { useEffect, useState } from 'react';
import axios from 'axios';
export default function AdminPanel({ token }) {
  const [users, setUsers] = useState([]);
  useEffect(()=> fetchUsers(), []);
  async function fetchUsers() {
    const r = await axios.get(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUsers(r.data);
  }
  async function toggleLock(u, lock){
    await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/admin/lock-user`, { userId: u.id, lock }, { headers: { Authorization: `Bearer ${token}` }});
    fetchUsers();
  }
  async function toggleBan(u, ban){
    await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/admin/ban-user`, { userId: u.id, ban }, { headers: { Authorization: `Bearer ${token}` }});
    fetchUsers();
  }
  return (
    <div style={{padding:20}}>
      <h2>Admin Panel — Users</h2>
      <table>
        <thead><tr><th>ID</th><th>Username</th><th>Locked</th><th>Banned</th><th>Action</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.locked? 'Yes':'No'}</td>
              <td>{u.banned? 'Yes':'No'}</td>
              <td>
                <button onClick={()=>toggleLock(u, !u.locked)}>{u.locked? 'UnLock':'Lock'}</button>
                <button onClick={()=>toggleBan(u, !u.banned)} style={{marginLeft:8}}>{u.banned? 'UnBan':'Ban'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
