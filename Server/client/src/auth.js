// auth.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthContext = createContext();
export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      api.get('/me', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => { setUser(r.data.user); localStorage.setItem('user', JSON.stringify(r.data.user)); })
        .catch(() => { setToken(null); setUser(null); });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, [token]);

  const login = (tokenValue, userValue) => {
    setToken(tokenValue);
    setUser(userValue);
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', JSON.stringify(userValue));
  };
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ token, user, login, logout, api }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
