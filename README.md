# EmmasEnvy

Full-stack nail salon platform: customer booking, staff operations, mobile POS, rewards, and support — built with **Next.js**, **Expo React Native**, **Express**, and **PostgreSQL**.

## What it does

| Surface | Purpose |
|---------|---------|
| **Website** | Marketing site, online booking, customer account, staff admin |
| **Mobile app** | Same customer/staff flows + **in-salon POS** (cash / Square) |
| **Backend API** | Auth, appointments, uploads, invoices, support, rewards |

Both clients share one API and one TypeScript package (`packages/shared`).

## Tech stack

Express · PostgreSQL · JWT auth · Next.js 16 · Expo · Square (optional)

## Quick start

**Prerequisites:** Node 20+, PostgreSQL 14+, `DemoAssets/` folder in repo.

```bash
npm install
cd backend && npm install && cp .env.example .env
# Set DATABASE_URL and JWT_SECRET (min 16 chars) in backend/.env
npm run db:setup && npm run db:seed-demo

cd backend && npm run dev          # API :5000
cd website && npm run dev          # Web :3000
cd mobile_app && npm start         # Expo
```

Per-app details: [backend/README.md](backend/README.md) · [website/README.md](website/README.md) · [mobile_app/README.md](mobile_app/README.md)

## Demo accounts

Password for all: **`Demo1234!`**

| Email | Role | Use for |
|-------|------|---------|
| `demo1@fake.com` | customer | Booking, rewards, support |
| `emma@fake.com` | admin | Staff queue, portfolio, services, POS |
| `demo5@fake.com` | it | Support queue (same staff tools as admin except portfolio/services) |

Reset demo data: `cd backend && npm run db:seed-demo` (wipes and re-seeds all tables).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/architecture.md](docs/architecture.md) | System layout, roles, feature parity |
| [docs/api-overview.md](docs/api-overview.md) | REST endpoint reference |
| [docs/testing-results.md](docs/testing-results.md) | QA pass results (Jul 2026) |
| [docs/bugs-and-improvements.md](docs/bugs-and-improvements.md) | Open bugs, planned features |

## Local dev notes

- **Password reset / email OTP:** codes log to the **backend terminal** (no production email yet).
- **Mobile on a physical device:** set `EXPO_PUBLIC_API_URL` to your PC's LAN IP, not `localhost`.
- **Square card payments:** optional; cash POS works without it. See mobile/backend README env vars.
