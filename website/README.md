# Website

Next.js app for Emmas Envy — customer-facing site and staff admin.

## Features

- **Customer:** home, portfolio, book, appointments, rewards, support, account/settings
- **Staff** (`admin` / `it`): `/staff/appointments`, portfolio, services, newsletters, promos, rewards, support queue

POS checkout is **mobile only**.

## Setup

Requires backend running on `:5000`.

```bash
cd website
cp .env.example .env
npm install
npm run dev    # http://localhost:3000
```

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

```bash
npm run build && npm run start   # production
```

## Staff routes

| Path | Purpose |
|------|---------|
| `/staff/appointments` | Appointment queue |
| `/staff/portfolio` | Portfolio management |
| `/staff/services` | Service types |
| `/staff/newsletters-promos` | Newsletters & promos |
| `/staff/rewards` | Reward offerings |
| `/staff/support` | Support queue |

## Shared code

API calls use `@emmasenvy/shared` (`packages/shared/`).

Demo login: `demo1@fake.com` / `emma@fake.com` — password `Demo1234!` after seed.
