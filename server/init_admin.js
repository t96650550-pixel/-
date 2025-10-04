const bcrypt = require('bcrypt');
const { db, init } = require('./db');

init();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PWD = process.env.ADMIN_PWD || 'admin123';

(async ()=>{
  const hash = await bcrypt.hash(ADMIN_PWD,10);
  db.get("SELECT * FROM users WHERE username = ?", [ADMIN_USER], (err,row)=>{
    if(err) throw err;
    if(row){
      console.log('Admin already exists');
      process.exit(0);
    } else {
      db.run(`INSERT INTO users (username,password,display_name,is_admin) VALUES (?,?,?,1)`,
        [ADMIN_USER, hash, 'Admin'], function(err){
          if(err) throw err;
          console.log('Admin created:', ADMIN_USER);
          process.exit(0);
        });
    }
  });
})();
