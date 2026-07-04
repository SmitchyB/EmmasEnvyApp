# Architecture

## Overview

**Website** (:3000) and **Mobile** (Expo) both use **`@emmasenvy/shared`**, which calls the **Backend** API (:5000). The API reads and writes **PostgreSQL** (`emmasenvy` schema).

- **Website** — Next.js customer site + `/staff/*` admin
- **Mobile** — Expo app; includes POS checkout (not on web)
- **Backend** — Express REST API, JWT auth, file uploads
- **Shared package** — API client, types, booking/rewards utils (keeps web and mobile in sync)
- **Database** — PostgreSQL schema `emmasenvy` (`database/schema.sql`)

Uploads (photos) are stored on disk under `backend/uploads/` and served at `/uploads/`.

## Roles

| Role | Access |
|------|--------|
| **customer** | Book, appointments, rewards, support, account |
| **admin** | All staff tools + site settings, portfolio, services, POS |
| **it** | Support queue and ops; no stylist portfolio/service management |

## Appointment flow

```
Pending → Confirmed → Checked In → In Progress → Complete → Paid
```

Staff advance status in the appointments UI. **Payment** is recorded via the **mobile POS** (cash or Square).

## Website vs mobile

| Feature | Web | Mobile |
|---------|-----|--------|
| Public site, portfolio, book | Yes | Yes |
| Customer appointments & support | Yes | Yes |
| Staff admin (queue, services, promos) | Yes | Yes |
| POS checkout | No | Yes |

## Demo data

`npm run db:seed-demo` (from `backend/`) truncates tables, copies images from `DemoAssets/`, and inserts users, services, appointments, portfolio, promos, and support tickets.

## Security

JWT sessions · role checks on staff routes · CORS for configured client origins
