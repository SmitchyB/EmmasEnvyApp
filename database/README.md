# Database setup (PostgreSQL)

EmmasEnvy stores all application data in PostgreSQL under the **`emmasenvy` schema**. The backend uses raw SQL via `pg` (no ORM). This folder contains the DDL and bootstrap data needed to run the app on your own database.

## Prerequisites

- PostgreSQL 14 or newer
- `psql` CLI (included with PostgreSQL), **or** use the Node setup script from the backend (see below)

## 1. Create a database and role

Example using `psql` as a superuser:

```sql
CREATE USER emmasenvy_app WITH PASSWORD 'your_secure_password';
CREATE DATABASE emmasenvy OWNER emmasenvy_app;
GRANT ALL PRIVILEGES ON DATABASE emmasenvy TO emmasenvy_app;
```

Connection string format:

```
postgresql://emmasenvy_app:your_secure_password@localhost:5432/emmasenvy
```

## 2. Apply schema and seed data

From the **repository root**:

```bash
psql "postgresql://emmasenvy_app:your_secure_password@localhost:5432/emmasenvy" -f database/schema.sql
psql "postgresql://emmasenvy_app:your_secure_password@localhost:5432/emmasenvy" -f database/seed.sql
```

Or from the **backend** folder (after copying `.env.example` to `.env` and setting `DATABASE_URL`):

```bash
cd backend
npm run db:setup
```

The setup script runs `schema.sql` then `seed.sql` using the `pg` package, so `psql` does not need to be on your PATH.

## 3. Configure the backend

Copy `backend/.env.example` to `backend/.env` and set at minimum:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | At least 16 characters; used for auth tokens |

Optional integrations:

- **Square** — card payments in mobile POS (`SQUARE_ACCESS_TOKEN`, `SQUARE_ENVIRONMENT`, `SQUARE_LOCATION_ID`)

Password-reset OTP codes are not sent by email in this project. In local development, codes are logged to the backend terminal.

Start the API:

```bash
cd backend
npm install
npm run dev
```

Default port is **5000**. Set `EXPO_PUBLIC_API_URL` in `mobile_app/.env` to match (e.g. `http://YOUR_LAN_IP:5000` on a physical device). See [root README](../README.md) and [mobile_app/README.md](../mobile_app/README.md).

## 4. Create your first admin user

1. Sign up through the app (all new accounts get `role = 'customer'`).
2. Promote your account in SQL:

```sql
UPDATE emmasenvy.users SET role = 'admin' WHERE email = 'you@example.com';
```

Valid roles used by the app include `customer`, `admin`, and `it`.

## Schema overview

| Table | Purpose |
|-------|---------|
| `users` | Accounts, auth, reward points |
| `user_sessions` | Login sessions and trusted devices |
| `site_settings` | Singleton row (`id = 1`) for home hero and policies |
| `service_type` | Bookable services per stylist |
| `appointments` | Booking workflow and status timestamps |
| `invoices` | POS/checkout; one service line per invoice |
| `promo_codes` | Discount codes |
| `reward_offerings` | Points redemption catalog |
| `portfolios` / `portfolio_photos` | Stylist gallery (`portfolios.id = 1` is the public primary portfolio) |
| `newsletters` | Email campaigns (draft when `sent_at` is null) |
| `support_tickets` / `support_ticket_messages` / `support_ticket_attachments` | Customer support |

## Custom schema name

The backend hardcodes `emmasenvy.<table>` in route and lib files. To use a different schema name, rename the schema in `schema.sql` and update the table constants in `backend/routes/` and `backend/lib/db.js`.

## Migrating an existing database

If you already have a live database with deprecated columns or tables, run manually:

```sql
ALTER TABLE emmasenvy.users DROP COLUMN IF EXISTS google_id;
ALTER TABLE emmasenvy.site_settings DROP COLUMN IF EXISTS products_enabled;
ALTER TABLE emmasenvy.invoices DROP COLUMN IF EXISTS tip_percentage;
DROP TABLE IF EXISTS emmasenvy.user_notification_preferences;
```

Then align any remaining columns with `schema.sql` as needed.

## Optional demo data

For a ready-to-explore dataset (Emma admin, four customers, services, promos, appointment history, portfolio gallery), run **after** `db:setup`:

```bash
cd backend
npm run db:seed-demo
```

**Warning:** This **truncates all rows** in every `emmasenvy` table (users, appointments, tickets, everything), then inserts fresh demo data. Tables and columns are not dropped. Safe to re-run anytime you want to reset after testing — just run `npm run db:seed-demo` again.

Requires the [`DemoAssets/`](../DemoAssets/) folder in the repo. See [DemoAssets/README.md](../DemoAssets/README.md). The seed uses **every image file** in `DemoAssets/Nails/` (currently ~20 nail photos). Copies images into `backend/uploads/` (gitignored).

Verify seed:

```sql
SELECT count(*) FROM emmasenvy.portfolio_photos;
SELECT email, role FROM emmasenvy.users ORDER BY id;
```

Or log in as `emma@fake.com` / `Demo1234!`.

| Email | Phone | Role | Password |
|-------|-------|------|----------|
| `emma@fake.com` | `1111111111` | admin | `Demo1234!` |
| `demo1@fake.com` | `2222222222` | customer (Maya) | `Demo1234!` |
| `demo2@fake.com` | `3333333333` | customer (Zuri) | `Demo1234!` |
| `demo3@fake.com` | `4444444444` | customer (Victoria) | `Demo1234!` |
| `demo4@fake.com` | `5555555555` | customer (Elena) | `Demo1234!` |
| `demo5@fake.com` | `6666666666` | it (Nia) | `Demo1234!` |

Demo seed sets the home hero, Emma's portfolio, six services, promo codes, reward offerings, newsletters, per-customer appointment/invoice history (with nail-art inspo and completed-visit photos), and six support tickets with image attachments. IT has no services or portfolio.
