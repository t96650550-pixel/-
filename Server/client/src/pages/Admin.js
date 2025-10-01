// Admin.js
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { motion } from 'framer-motion';

export default function Admin(){
  const { api, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const r = await api.get('/admin/users', { headers: { Authorization: 'Bearer ' + token }});
      setUsers(r.data.users);
    } catch (err) {
      alert(err.response?.data?.error || 'Không lấy được danh sách user');
    } finally { setLoading(false); }
  };

  useEffect(()=> { fetchUsers(); }, []);

  const toggle = async (id, disabled) => {
    try {
      if (disabled) await api.post(`/admin/users/${id}/enable`, {}, { headers: { Authorization: 'Bearer ' + token }});
      else await api.post(`/admin/users/${id}/disable`, { type: 'forever' }, { headers: { Authorization: 'Bearer ' + token }});
      fetchUsers();
    } catch (err) { alert('Action failed'); }
  };

  const changeRole = async (id, role) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role }, { headers: { Authorization: 'Bearer ' + token }});
      fetchUsers();
    } catch (err) { alert('Change role failed'); }
  };

  const removeUser = async (id) => {
    if (!confirm('Xác nhận xóa user?')) return;
    try {
      await api.delete(`/admin/users/${id}`, { headers: { Authorization: 'Bearer ' + token }});
      fetchUsers();
    } catch (err) { alert('Delete failed'); }
  };

  return (
    <motion.div className="app-card" initial={{opacity:0}} animate={{opacity:1}}>
      <h2>Admin Panel</h2>
      {loading ? <div>Loading...</div> : (
        <table className="table">
          <thead><tr><th>ID</th><th>Username</th><th>Display</th><th>Role</th><th>Disabled</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>
                  <select value={u.role} onChange={(e)=>changeRole(u.id, e.target.value)}>
                    <option value="user">user</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </td>
                <td>{u.disabled ? 'Yes' : 'No'}</td>
                <td>
                  <button onClick={()=>toggle(u.id, u.disabled)} className="btn" style={{marginRight:6}}>{u.disabled ? 'Enable' : 'Disable'}</button>
                  <button onClick={()=>removeUser(u.id)} className="btn">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}
