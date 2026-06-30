-- EmmasEnvy bootstrap data (idempotent)
-- Run after schema.sql: psql "$DATABASE_URL" -f database/seed.sql

-- Singleton site settings row required by the backend (id = 1).
INSERT INTO emmasenvy.site_settings (id, rewards_enabled, updated_at)
VALUES (1, TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- Primary public portfolio (GET /api/portfolios/primary expects id = 1).
INSERT INTO emmasenvy.portfolios (id, employee_id, description, visible, created_at, updated_at)
VALUES (1, NULL, NULL, TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Reset portfolio serial so the next auto-generated id does not collide with id = 1.
SELECT setval(pg_get_serial_sequence('emmasenvy.portfolios', 'id'), GREATEST((SELECT MAX(id) FROM emmasenvy.portfolios), 1));

-- After signing up in the app, promote your account to admin:
-- UPDATE emmasenvy.users SET role = 'admin' WHERE email = 'you@example.com';
--
-- Optional demo data (Emma, customers, services, appointments): npm run db:seed-demo
