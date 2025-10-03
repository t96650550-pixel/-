// server/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// middleware ensures JWT verified and user set in req.user
router.use(async (req,res,next) => {
  if(!req.user) return res.status(401).json({ error: 'unauth' });
  if(req.user.role !== 'admin') return res.status(403).json({ error: 'not admin' });
  next();
});

router.post('/lock-user', async (req,res) => {
  const { userId, lock } = req.body;
  await db.run('UPDATE users SET locked = ? WHERE id = ?', [lock ? 1 : 0, userId]);
  res.json({ ok: true });
});

router.post('/ban-user', async (req,res) => {
  const { userId, ban } = req.body;
  await db.run('UPDATE users SET banned = ? WHERE id = ?', [ban ? 1 : 0, userId]);
  res.json({ ok: true });
});

router.post('/delete-message', async (req,res) => {
  const { messageId } = req.body;
  await db.run('UPDATE messages SET deleted = 1 WHERE id = ?', [messageId]);
  res.json({ ok: true });
});

router.get('/users', async (req,res) => {
  const u = await db.all('SELECT id,username,email,role,locked,banned FROM users ORDER BY id DESC');
  res.json(u);
});

module.exports = router;
