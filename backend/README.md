# Backend API

Express REST API for EmmasEnvy. Serves JSON at `/api/*` and uploaded files at `/uploads/*`.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Required in `.env`:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 16 characters |

```bash
npm run db:setup       # apply schema
npm run db:seed-demo   # demo users + data (needs DemoAssets/)
npm run dev            # :5000, nodemon
```

## Structure

| Path | Purpose |
|------|---------|
| `routes/` | API route handlers (auth, appointments, support, …) |
| `middleware/` | JWT auth, role guards |
| `lib/` | DB pool, JWT, uploads (Multer), Square |
| `uploads/` | Profile, portfolio, appointment, support files |
| `scripts/seed-demo.js` | Demo seed script |

## Optional: Square

For card payments in the mobile POS:

```env
SQUARE_ACCESS_TOKEN=
SQUARE_LOCATION_ID=
SQUARE_ENVIRONMENT=sandbox
```

Cash checkout works without Square.

## Dev notes

- Password-reset and OTP codes **print to this terminal** in local dev (no email provider wired).
- API reference: [docs/api-overview.md](../docs/api-overview.md)
