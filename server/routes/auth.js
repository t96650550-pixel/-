// server/routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

router.post('/register', async (req,res) => {
  const { username, email, password } = req.body;
  if(!username||!email||!password) return res.status(400).json({ error: 'Missing' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await db.run('INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)', [username, email, hash, 'user']);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'Username or email taken' });
  }
});

router.post('/login', async (req,res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  if(!user) return res.status(400).json({ error: 'Invalid' });
  if(user.locked) return res.status(403).json({ error: 'Account locked' });
  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.status(400).json({ error: 'Invalid' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// request reset
router.post('/request-reset', async (req,res) => {
  const { email } = req.body;
  if(!email) return res.json({ ok: true });
  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if(!user) return res.json({ ok: true });
  const token = crypto.randomBytes(20).toString('hex');
  const exp = Date.now() + 1000 * 60 * 60; // 1h
  await db.run('UPDATE users SET reset_token=?, reset_exp=? WHERE id=?', [token, exp, user.id]);

  // send email (requires env SMTP)
  if(process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    const link = `${process.env.CLIENT_ORIGIN}/reset-password?token=${token}&id=${user.id}`;
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to: user.email,
      subject: 'Reset mật khẩu',
      text: `Click: ${link}`
    });
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req,res) => {
  const { id, token, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if(!user || user.reset_token !== token || user.reset_exp < Date.now()) return res.status(400).json({ error: 'Invalid or expired' });
  const hash = await bcrypt.hash(password, 10);
  await db.run('UPDATE users SET password=?, reset_token=NULL, reset_exp=NULL WHERE id=?', [hash, id]);
  res.json({ ok: true });
});

module.exports = router;
