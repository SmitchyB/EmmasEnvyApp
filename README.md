# EmmasEnvy App

Full-stack nail salon app: Expo (React Native) frontend and Express + PostgreSQL backend.

## Quick start

1. **Database** — [database/README.md](database/README.md)  
   Create a PostgreSQL database, run `database/schema.sql` and `database/seed.sql`, or use `npm run db:setup` from the backend.

2. **Backend** — API server  
   ```bash
   cd backend
   cp .env.example .env   # set DATABASE_URL and JWT_SECRET (min 16 chars)
   npm install
   npm run dev
   ```
   Listens on port **5000** by default (`PORT` in `.env`).

3. **Frontend** — Expo app  
   See [frontend/README.md](frontend/README.md). Set `EXPO_PUBLIC_API_URL` to your backend URL (e.g. `http://192.168.1.5:5000` on a physical device).

4. **First admin** — Sign up in the app, then:
   ```sql
   UPDATE emmasenvy.users SET role = 'admin' WHERE email = 'you@example.com';
   ```
   Or use optional demo seed: `cd backend && npm run db:seed-demo` (wipes all table data, then seeds demo — login as `emma@fake.com` / `Demo1234!`; see [database/README.md](database/README.md)).

## Project layout

| Path | Description |
|------|-------------|
| `database/` | PostgreSQL schema, seed data, setup docs |
| `backend/` | Express API, file uploads, Square/Brevo integrations |
| `frontend/` | Expo / React Native client |

## Optional integrations

- **Square** — card payments at POS (`SQUARE_*` in backend `.env`)
- **Brevo** — SMTP for OTP emails (`BREVO_SMTP_*` in backend `.env`)

Cash checkout works without Square. Password reset OTP requires SMTP or another mail path you configure separately.
