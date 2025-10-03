// server/middlewares/auth.js
const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'please_change_me';

async function verifyTokenSocket(token) {
  if(!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT id,username,role,locked,banned FROM users WHERE id = ?', [payload.id]);
    return user ? { id: user.id, username: user.username, role: user.role, locked: user.locked, banned: user.banned } : null;
  } catch(e) { return null; }
}

function verifyTokenMiddleware(req,res,next) {
  const hdr = req.headers.authorization;
  if(!hdr) return res.status(401).json({ error: 'no token' });
  const token = hdr.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) { res.status(401).json({ error: 'invalid token' }); }
}

module.exports = { verifyTokenSocket, verifyTokenMiddleware };
