-- Reward offerings: optional scope to a bookable service type (null = any service).
-- Safe for existing DBs: add column only if missing. Greenfield: create table if missing.

CREATE TABLE IF NOT EXISTS emmasenvy.reward_offerings (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  point_cost INTEGER NOT NULL,
  value NUMERIC,
  min_purchase_amount NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE emmasenvy.reward_offerings
  ADD COLUMN IF NOT EXISTS service_type_id INTEGER REFERENCES emmasenvy.service_type (id);
