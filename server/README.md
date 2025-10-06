# Chat App - Render Ready (minimal)

## Overview
- Backend: Node.js + Express + SQLite
- Realtime: socket.io
- Auth: JWT access + refresh (stored in httpOnly cookie)
- Password reset: token emailed (token hash stored)
- Admin endpoints included

## Deploy to Render
1. Create a new Web Service on Render, connect to your repo (or upload).
2. Set `Start Command` to `npm start` in `server` folder.
3. Add environment variables from `.env.example` (JWT secrets, SMTP settings, FRONTEND_URL).
4. If you want a managed Postgres DB, change `db.js` to use Postgres and update connection string.

## Dev
- Run server:
  ```bash
  cd server
  npm install
  npm run dev
  ```
- Run client:
  ```bash
  cd client
  npm install
  npm start
  ```

## Notes
- This is a minimal starting point. For production, switch to Postgres, add HTTPS, tighten CORS, and secure cookies.
