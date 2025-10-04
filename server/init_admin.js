const bcrypt = require("bcrypt");
const { db, init } = require("./db");

init();

const username = "admin";
const password = "admin123";

(async () => {
  const hashed = await bcrypt.hash(password, 10);
  db.run(
    "INSERT OR IGNORE INTO users (username,password,display_name,is_admin) VALUES (?,?,?,1)",
    [username, hashed, "Administrator"],
    function (err) {
      if (err) console.error("❌ Lỗi:", err.message);
      else console.log("✅ Admin đã tạo (username=admin, password=admin123)");
      process.exit(0);
    }
  );
})();
