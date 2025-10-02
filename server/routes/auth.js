const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username,password,displayName) VALUES (?,?,?)`, [username,hash, displayName||username], function(err) {
    if (err) {
      return res.status(400).json({ error: 'User exists or invalid' });
    }
    const user = { id: this.lastID, username, role: 'user' };
    const token = signToken(user);
    res.json({ token, user: { id: user.id, username, displayName: displayName||username, role: 'user' }});
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, row) => {
    if (!row) return res.status(400).json({ error: 'Invalid credentials' });
    if (row.locked == 2) return res.status(403).json({ error: 'Account permanently locked' });
    if (row.locked == 1) return res.status(403).json({ error: 'Account temporarily locked: ' + (row.lock_reason||'') });
    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken(row);
    res.json({ token, user: { id: row.id, username: row.username, displayName: row.displayName, role: row.role }});
  });
});

module.exports = router;
