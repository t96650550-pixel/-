import React, { useState } from "react";
import Auth from "./Auth";
import "./auth.css";

function App() {
  const [user, setUser] = useState(null);

  return (
    <div>
      {!user ? (
        <Auth onLogin={setUser} />
      ) : (
        <h2>Chào {user.display_name}! ✨ Chat sắp tới nha~</h2>
      )}
    </div>
  );
}

export default App;
