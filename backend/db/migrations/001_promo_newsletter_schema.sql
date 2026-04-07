-- Promo scoped to a bookable service type (nullable = any service).
ALTER TABLE emmasenvy.promo_codes
  ADD COLUMN IF NOT EXISTS service_type_id INTEGER REFERENCES emmasenvy.service_type (id);

-- Track promo_ids each customer has redeemed (server-side only; do not expose in public user JSON).
ALTER TABLE emmasenvy.users
  ADD COLUMN IF NOT EXISTS used_promo_codes INTEGER[] NOT NULL DEFAULT '{}';
