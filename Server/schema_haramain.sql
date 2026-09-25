-- ============================================================
-- TAMIMA HARAMAIN HIGH-SPEED RAILWAY (HHR) — PostgreSQL Schema
-- Independent module: does NOT alter hotel booking tables.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Stations reference (seeded, read-only for app)
CREATE TABLE IF NOT EXISTS haramain_stations (
  code        VARCHAR(10) PRIMARY KEY,  -- MKK, JED, JED-AIR, KAEC, MDN
  name        VARCHAR(120) NOT NULL,
  short_name  VARCHAR(40) NOT NULL,
  city        VARCHAR(40) NOT NULL
);

INSERT INTO haramain_stations (code, name, short_name, city) VALUES
  ('MKK',     'Makkah Station — Rusayfah',          'Makkah',         'Makkah'),
  ('JED-AIR', 'Jeddah Airport Station — KAIA T1',   'Jeddah Airport', 'Jeddah'),
  ('JED',     'Jeddah Central — Al Sulaymaniyah',   'Jeddah',         'Jeddah'),
  ('KAEC',    'KAEC Station — Rabigh',              'KAEC',           'Rabigh'),
  ('MDN',     'Madinah Station',                    'Madinah',        'Madina')
ON CONFLICT (code) DO NOTHING;

-- Main booking header (one row per ticket order)
CREATE TABLE IF NOT EXISTS haramain_bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_ref           VARCHAR(24) NOT NULL UNIQUE,       -- HHR-YYYY-XXXX
  status              VARCHAR(16) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft','Unpaid','Partial','Paid','Cancelled')),
  staff_name          VARCHAR(120) NOT NULL DEFAULT '',
  source              VARCHAR(16) NOT NULL DEFAULT 'manual',
  booking_type        VARCHAR(16) NOT NULL DEFAULT 'Private',
  customer_name       VARCHAR(160) NOT NULL,
  travel_company      VARCHAR(160),
  customer_phone      VARCHAR(40)  NOT NULL DEFAULT '',
  customer_email      VARCHAR(160) NOT NULL DEFAULT '',
  customer_country    VARCHAR(60)  NOT NULL DEFAULT 'Indonesia',
  notes               TEXT,

  trip_type           VARCHAR(16) NOT NULL DEFAULT 'One-Way',
  origin_code         VARCHAR(10) NOT NULL REFERENCES haramain_stations(code),
  destination_code    VARCHAR(10) NOT NULL REFERENCES haramain_stations(code),
  train_class         VARCHAR(16) NOT NULL DEFAULT 'Economy',

  vendor_name         VARCHAR(160),
  vendor_pic          VARCHAR(120),

  input_currency      CHAR(3) NOT NULL DEFAULT 'SAR',
  exchange_rate       NUMERIC(12,2) NOT NULL DEFAULT 4250,
  cost_per_pax        NUMERIC(14,2) NOT NULL DEFAULT 0,
  sell_per_pax        NUMERIC(14,2) NOT NULL DEFAULT 0,
  pax_count           INTEGER NOT NULL DEFAULT 0,

  total_cost_sar      NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_sell_sar      NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_cost_idr      NUMERIC(20,0) NOT NULL DEFAULT 0,
  total_sell_idr      NUMERIC(20,0) NOT NULL DEFAULT 0,
  profit_sar          NUMERIC(16,2) NOT NULL DEFAULT 0,
  profit_idr          NUMERIC(20,0) NOT NULL DEFAULT 0,
  profit_margin_pct   NUMERIC(8,2)  NOT NULL DEFAULT 0,

  amount_paid_sar     NUMERIC(16,2) NOT NULL DEFAULT 0,
  amount_paid_idr     NUMERIC(20,0) NOT NULL DEFAULT 0,
  payment_exchange_rate NUMERIC(12,2),
  payment_method      VARCHAR(60)  NOT NULL DEFAULT 'Bank Transfer (BCA/Mandiri)',
  due_date            DATE,
  payment_reference   VARCHAR(120),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_haramain_route CHECK (origin_code <> destination_code)
);

CREATE INDEX IF NOT EXISTS idx_haramain_departure ON haramain_bookings (origin_code, destination_code);
CREATE INDEX IF NOT EXISTS idx_haramain_status ON haramain_bookings (status);
CREATE INDEX IF NOT EXISTS idx_haramain_customer ON haramain_bookings (customer_name, travel_company);

-- Journey legs (1 for one-way, 2 for round-trip)
CREATE TABLE IF NOT EXISTS haramain_legs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES haramain_bookings(id) ON DELETE CASCADE,
  direction       VARCHAR(16) NOT NULL, -- Outbound | Return
  train_no        VARCHAR(24) NOT NULL DEFAULT '',
  departure_date  DATE NOT NULL,
  departure_time  VARCHAR(8) NOT NULL DEFAULT '00:00',
  arrival_date    DATE NOT NULL,
  arrival_time    VARCHAR(8) NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_haramain_legs_booking ON haramain_legs (booking_id);
CREATE INDEX IF NOT EXISTS idx_haramain_legs_dep ON haramain_legs (departure_date);

-- Passengers (seat manifest)
CREATE TABLE IF NOT EXISTS haramain_passengers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES haramain_bookings(id) ON DELETE CASCADE,
  full_name     VARCHAR(160) NOT NULL,
  id_number     VARCHAR(60) NOT NULL DEFAULT '',
  nationality   VARCHAR(60) NOT NULL DEFAULT 'Indonesia',
  category      VARCHAR(16) NOT NULL DEFAULT 'Adult',
  seat_coach    VARCHAR(10) NOT NULL DEFAULT '',
  seat_number   VARCHAR(10) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_haramain_pax_booking ON haramain_passengers (booking_id);

-- Extra items (handling, transfer, etc.)
CREATE TABLE IF NOT EXISTS haramain_extras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES haramain_bookings(id) ON DELETE CASCADE,
  description VARCHAR(200) NOT NULL,
  cost        NUMERIC(14,2) NOT NULL DEFAULT 0,
  sell        NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- Payments (customer → TAMIMA ledger for train orders)
CREATE TABLE IF NOT EXISTS haramain_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    UUID NOT NULL REFERENCES haramain_bookings(id) ON DELETE CASCADE,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_sar    NUMERIC(16,2) NOT NULL DEFAULT 0,
  amount_idr    NUMERIC(20,0) NOT NULL DEFAULT 0,
  exchange_rate NUMERIC(12,2) NOT NULL DEFAULT 4250,
  method        VARCHAR(60) NOT NULL DEFAULT 'Bank Transfer (BCA/Mandiri)',
  reference     VARCHAR(120),
  note          TEXT
);
CREATE INDEX IF NOT EXISTS idx_haramain_pay_booking ON haramain_payments (booking_id);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION haramain_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_haramain_bookings_touch ON haramain_bookings;
CREATE TRIGGER trg_haramain_bookings_touch
  BEFORE UPDATE ON haramain_bookings
  FOR EACH ROW EXECUTE FUNCTION haramain_touch_updated_at();
