const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function authAdmin(req,res,next){
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({error:'no auth'});
  try{
    const payload = jwt.verify(auth, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({error:'not admin'});
    req.user = payload; next();
  }catch(e){ return res.status(401).json({error:'invalid token'})}
}

// lock/unlock user
router.post('/lock', authAdmin, (req,res) => {
  const { username, mode, reason } = req.body; // mode: 'temp' or 'permanent' or 'unlock'
  if (!username || !mode) return res.status(400).json({error:'missing'});
  if (mode==='unlock') {
    db.run(`UPDATE users SET locked=0, lock_reason=NULL WHERE username=?`, [username], function(err){
      if(err) return res.status(500).json({error:'db'});
      res.json({ok:true});
    });
  } else if (mode==='temp') {
    db.run(`UPDATE users SET locked=1, lock_reason=? WHERE username=?`, [reason||'temp locked', username], function(err){
      if(err) return res.status(500).json({error:'db'});
      res.json({ok:true});
    });
  } else if (mode==='permanent') {
    db.run(`UPDATE users SET locked=2, lock_reason=? WHERE username=?`, [reason||'permanently locked', username], function(err){
      if(err) return res.status(500).json({error:'db'});
      res.json({ok:true});
    });
  } else res.status(400).json({error:'invalid mode'});
});

module.exports = router;
