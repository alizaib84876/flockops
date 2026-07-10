-- FlockOps — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Designed for Phase A (single farm) with Phase B (multi-tenant) in mind:
-- every table is scoped under farm_id so RLS can enforce tenant isolation
-- in Phase B without any schema changes.

-- ─────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('platform_admin', 'owner', 'manager', 'worker');
CREATE TYPE farm_member_role AS ENUM ('owner', 'manager', 'worker');
CREATE TYPE batch_status AS ENUM ('active', 'harvested', 'closed');
CREATE TYPE expense_category AS ENUM ('chicks', 'feed', 'medicine', 'labor', 'utilities', 'other');
CREATE TYPE vaccination_status AS ENUM ('scheduled', 'completed', 'missed');
CREATE TYPE alert_type AS ENUM ('mortality_spike', 'vaccination_due', 'low_feed_stock');
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');

-- ─────────────────────────────────────────────────────────────────
-- USERS
-- Extends Supabase auth.users. One row per authenticated user.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'worker',
  farm_id     UUID, -- NULL for platform_admin; set after farm creation for owners
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- FARMS
-- One row = one tenant (Phase A: exactly one farm).
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.farms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  owner_user_id       UUID NOT NULL REFERENCES public.users(id),
  subscription_tier   subscription_plan NOT NULL DEFAULT 'free',
  subscription_status subscription_status NOT NULL DEFAULT 'trialing',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Back-fill the farm_id FK now that farms table exists
ALTER TABLE public.users
  ADD CONSTRAINT users_farm_id_fkey
  FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────
-- FARM MEMBERS
-- Maps users to farms with a role; supports Phase B multi-user farms.
-- assigned_shed_ids is used for worker role to restrict shed access.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.farm_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role              farm_member_role NOT NULL DEFAULT 'worker',
  assigned_shed_ids UUID[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────
-- SHEDS
-- Physical broiler houses. Belongs to a farm.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.sheds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id     UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- BATCHES
-- One production cycle per shed. Only one can be 'active' per shed.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shed_id               UUID NOT NULL REFERENCES public.sheds(id) ON DELETE CASCADE,
  breed                 TEXT NOT NULL,
  placement_date        DATE NOT NULL,
  starting_bird_count   INTEGER NOT NULL CHECK (starting_bird_count > 0),
  target_harvest_weight NUMERIC(6,2), -- kg per bird at target harvest
  status                batch_status NOT NULL DEFAULT 'active',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce: only one active batch per shed at a time
CREATE UNIQUE INDEX batches_one_active_per_shed
  ON public.batches (shed_id)
  WHERE (status = 'active');

-- ─────────────────────────────────────────────────────────────────
-- DAILY LOGS
-- Core data entry. One row per shed per day during an active batch.
-- Required fields: mortality_count, feed_given_kg, feed_stock_remaining_kg
-- Optional: water, temperature, humidity, notes
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.daily_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  log_date                DATE NOT NULL,
  -- Required per spec §9 data quality standards
  mortality_count         INTEGER NOT NULL CHECK (mortality_count >= 0),
  feed_given_kg           NUMERIC(8,2) NOT NULL CHECK (feed_given_kg >= 0),
  feed_stock_remaining_kg NUMERIC(8,2) NOT NULL CHECK (feed_stock_remaining_kg >= 0),
  -- Optional but encouraged
  water_consumption_l     NUMERIC(8,2) CHECK (water_consumption_l >= 0),
  temperature_c           NUMERIC(5,2),
  humidity_pct            NUMERIC(5,2) CHECK (humidity_pct >= 0 AND humidity_pct <= 100),
  notes                   TEXT,
  -- Attribution — required per spec §9 (timestamped, attributable entries)
  logged_by_user_id       UUID NOT NULL REFERENCES public.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One log per batch per day
  UNIQUE (batch_id, log_date)
);

-- ─────────────────────────────────────────────────────────────────
-- DAILY LOG EDITS (Audit Trail)
-- Per spec §9: "corrections should be recorded as edit history rather
-- than overwriting the original value."
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.daily_log_edits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id       UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  edited_by_user_id  UUID NOT NULL REFERENCES public.users(id),
  field_name         TEXT NOT NULL,
  old_value          TEXT,
  new_value          TEXT,
  edited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on daily_logs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────
-- WEIGHT SAMPLES
-- Periodic bird weighing. Used to calculate FCR and plot growth curve.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.weight_samples (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  sample_date DATE NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size > 0),
  avg_weight_g NUMERIC(8,2) NOT NULL CHECK (avg_weight_g > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- VACCINATIONS
-- Scheduled and completed vaccination/medication events per batch.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.vaccinations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  vaccine_name    TEXT NOT NULL,
  scheduled_date  DATE NOT NULL,
  completed_date  DATE,
  status          vaccination_status NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- EXPENSES
-- Cost entries per batch, categorized for P&L calculation.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  category     expense_category NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- SALES / HARVEST RECORDS
-- Closing record for a batch. One per batch at harvest.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.sales (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id             UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  buyer_name           TEXT NOT NULL,
  sale_date            DATE NOT NULL,
  total_weight_kg      NUMERIC(10,2) NOT NULL CHECK (total_weight_kg >= 0),
  rate_per_kg          NUMERIC(8,2) NOT NULL CHECK (rate_per_kg >= 0),
  condemned_birds_count INTEGER NOT NULL DEFAULT 0 CHECK (condemned_birds_count >= 0),
  total_amount         NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id) -- one sale record per batch
);

-- ─────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- Phase B billing records. Created in Phase A with free/trialing defaults.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  plan              subscription_plan NOT NULL DEFAULT 'free',
  status            subscription_status NOT NULL DEFAULT 'trialing',
  start_date        DATE NOT NULL,
  next_billing_date DATE,
  payment_method    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farm_id)
);

-- ─────────────────────────────────────────────────────────────────
-- ALERTS
-- In-app notifications: mortality spikes, vaccination reminders, low feed.
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE public.alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id      UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  shed_id      UUID REFERENCES public.sheds(id) ON DELETE SET NULL,
  batch_id     UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  type         alert_type NOT NULL,
  message      TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────
-- INDEXES (performance for common queries)
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_sheds_farm_id ON public.sheds(farm_id);
CREATE INDEX idx_batches_shed_id ON public.batches(shed_id);
CREATE INDEX idx_batches_status ON public.batches(status);
CREATE INDEX idx_daily_logs_batch_id ON public.daily_logs(batch_id);
CREATE INDEX idx_daily_logs_log_date ON public.daily_logs(log_date);
CREATE INDEX idx_weight_samples_batch_id ON public.weight_samples(batch_id);
CREATE INDEX idx_vaccinations_batch_id ON public.vaccinations(batch_id);
CREATE INDEX idx_vaccinations_scheduled_date ON public.vaccinations(scheduled_date);
CREATE INDEX idx_expenses_batch_id ON public.expenses(batch_id);
CREATE INDEX idx_alerts_farm_id ON public.alerts(farm_id);
CREATE INDEX idx_alerts_resolved_at ON public.alerts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_farm_members_farm_id ON public.farm_members(farm_id);
CREATE INDEX idx_farm_members_user_id ON public.farm_members(user_id);

-- ─────────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY (Phase A: disabled; structure in place for Phase B)
-- Enable RLS on all tables so it can be switched on for Phase B
-- without schema changes. Policies added in a later migration.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_log_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Phase A: permissive policies (allow all authenticated users).
-- Phase B migration will replace these with farm-scoped policies.

CREATE POLICY "Phase A: allow all authenticated" ON public.users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.farms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.farm_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.sheds
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.daily_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.daily_log_edits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.weight_samples
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.vaccinations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.subscriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Phase A: allow all authenticated" ON public.alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- Inserts a row in public.users when a new Supabase Auth user signs up.
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'owner' -- default role; platform_admin set manually
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
