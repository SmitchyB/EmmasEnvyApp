-- EmmasEnvy PostgreSQL schema
-- Run against a fresh database: psql "$DATABASE_URL" -f database/schema.sql
--
-- The backend hardcodes the schema name "emmasenvy" in table constants.
-- To use a different schema, rename here and update backend route/lib files.

CREATE SCHEMA IF NOT EXISTS emmasenvy;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.users (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  phone TEXT,
  profile_picture TEXT,
  email TEXT,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  two_factor_type TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT,
  otp TEXT,
  otp_expires TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reward_points INTEGER NOT NULL DEFAULT 0,
  used_promo_codes INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]
);

CREATE UNIQUE INDEX users_email_unique ON emmasenvy.users (email) WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- user_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES emmasenvy.users (id) ON DELETE CASCADE,
  session_token UUID NOT NULL,
  device_name TEXT,
  device_fingerprint TEXT,
  ip_address TEXT,
  is_2fa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_trusted_device BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX user_sessions_session_token_unique ON emmasenvy.user_sessions (session_token);
CREATE INDEX user_sessions_user_id_idx ON emmasenvy.user_sessions (user_id);

-- ---------------------------------------------------------------------------
-- site_settings (singleton row id = 1)
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.site_settings (
  id INTEGER PRIMARY KEY,
  rewards_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  home_hero_image TEXT,
  hero_title TEXT,
  home_hero_material TEXT,
  policy_appointment_cancellation TEXT,
  policy_service_guarantee_fix TEXT,
  policy_shipping_fulfillment TEXT,
  policy_rewards_loyalty TEXT,
  policy_privacy TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- service_type
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.service_type (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  duration_needed INTERVAL,
  price NUMERIC(12, 2),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX service_type_employee_id_idx ON emmasenvy.service_type (employee_id);

-- ---------------------------------------------------------------------------
-- portfolios
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.portfolios (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  description TEXT,
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX portfolios_employee_id_idx ON emmasenvy.portfolios (employee_id);

-- ---------------------------------------------------------------------------
-- portfolio_photos
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.portfolio_photos (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES emmasenvy.portfolios (id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX portfolio_photos_portfolio_id_idx ON emmasenvy.portfolio_photos (portfolio_id);

-- ---------------------------------------------------------------------------
-- promo_codes
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.promo_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(12, 2) NOT NULL,
  min_purchase_amount NUMERIC(12, 2),
  expiration_date DATE,
  usage_limit INTEGER,
  current_usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_type_id INTEGER REFERENCES emmasenvy.service_type (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX promo_codes_code_unique ON emmasenvy.promo_codes (code);

-- ---------------------------------------------------------------------------
-- reward_offerings
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.reward_offerings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  value NUMERIC(12, 2),
  min_purchase_amount NUMERIC(12, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_type_id INTEGER REFERENCES emmasenvy.service_type (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- invoices (appointment_id FK added after appointments table)
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.invoices (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  customer_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_by INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_received NUMERIC(12, 2),
  change_due NUMERIC(12, 2),
  reward_offering_id INTEGER REFERENCES emmasenvy.reward_offerings (id) ON DELETE SET NULL,
  reward_points_used INTEGER,
  points_awarded INTEGER,
  appointment_id INTEGER,
  service_title TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  square_payment_id VARCHAR(255),
  tip_amount NUMERIC(12, 2),
  checkout_idempotency_key VARCHAR(255),
  checkout_snapshot JSONB
);

CREATE INDEX invoices_customer_id_idx ON emmasenvy.invoices (customer_id);
CREATE INDEX invoices_appointment_id_idx ON emmasenvy.invoices (appointment_id);
CREATE INDEX invoices_invoice_id_idx ON emmasenvy.invoices (invoice_id);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  employee_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TIME WITHOUT TIME ZONE NOT NULL,
  description TEXT,
  inspo_pics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration INTERVAL,
  invoice_id INTEGER REFERENCES emmasenvy.invoices (id) ON DELETE SET NULL,
  service_type_id INTEGER REFERENCES emmasenvy.service_type (id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  rescheduled_at TIMESTAMPTZ,
  completed_photos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX appointments_employee_date_idx ON emmasenvy.appointments (employee_id, date);
CREATE INDEX appointments_client_id_idx ON emmasenvy.appointments (client_id);
CREATE INDEX appointments_invoice_id_idx ON emmasenvy.appointments (invoice_id);

ALTER TABLE emmasenvy.invoices
  ADD CONSTRAINT invoices_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES emmasenvy.appointments (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- newsletters
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.newsletters (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  promo_code_id INTEGER REFERENCES emmasenvy.promo_codes (id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.support_tickets (
  id BIGSERIAL PRIMARY KEY,
  public_reference TEXT NOT NULL,
  user_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_phone TEXT,
  subject TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  handler_team TEXT,
  linked_appointment_id INTEGER REFERENCES emmasenvy.appointments (id) ON DELETE SET NULL,
  linked_invoice_id INTEGER REFERENCES emmasenvy.invoices (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_staff',
  priority TEXT,
  assigned_to_user_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX support_tickets_public_reference_unique ON emmasenvy.support_tickets (public_reference);
CREATE INDEX support_tickets_user_id_idx ON emmasenvy.support_tickets (user_id);
CREATE INDEX support_tickets_status_idx ON emmasenvy.support_tickets (status);

-- ---------------------------------------------------------------------------
-- support_ticket_messages
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.support_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES emmasenvy.support_tickets (id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL,
  author_user_id INTEGER REFERENCES emmasenvy.users (id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_ticket_messages_ticket_id_idx ON emmasenvy.support_ticket_messages (ticket_id);

-- ---------------------------------------------------------------------------
-- support_ticket_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE emmasenvy.support_ticket_attachments (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES emmasenvy.support_ticket_messages (id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_ticket_attachments_message_id_idx ON emmasenvy.support_ticket_attachments (message_id);
