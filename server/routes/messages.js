// server/routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/history', async (req,res) => {
  const msgs = await db.all('SELECT * FROM messages WHERE deleted = 0 ORDER BY created_at DESC LIMIT 200');
  res.json(msgs.reverse());
});

module.exports = router;
