-- ================================================================
-- PAYMENT VERIFIER — COMPLETE DATABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor
-- ================================================================

-- ── PROFILES (roles + method assignments) ───────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  role            TEXT NOT NULL DEFAULT 'agent',    -- 'agent' | 'finance' | 'admin'
  payment_methods TEXT[] DEFAULT '{}',              -- e.g. '{CashApp,Zelle}'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'agent')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── PAYMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  transaction_id   TEXT,
  amount           TEXT,
  sender_name      TEXT,
  receiver_name    TEXT,
  memo             TEXT,
  date_time        TEXT,
  payment_method   TEXT,
  screenshot_url   TEXT,
  image_hash       TEXT,
  phash            TEXT,
  uploaded_by      TEXT,
  agent_email      TEXT,
  status           TEXT DEFAULT 'verified',           -- AI check: verified | suspicious | duplicate
  approval_status  TEXT DEFAULT 'pending_review',     -- Finance: pending_review | approved | rejected
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT
);

-- ── TAGS (one active tag per payment method) ─────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL UNIQUE,
  tag_value      TEXT,
  tag_label      TEXT,
  updated_by     TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active      BOOLEAN DEFAULT TRUE
);

-- Tag change history
CREATE TABLE IF NOT EXISTS tag_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  changed_by     TEXT,
  changed_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default empty rows for all methods
INSERT INTO tags (payment_method) VALUES
  ('CashApp'),('Chime'),('Zelle'),('TapTap'),('Venmo'),('PayPal')
ON CONFLICT (payment_method) DO NOTHING;

-- ── TAG REQUESTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL,
  requested_by   TEXT NOT NULL,
  requested_at   TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT DEFAULT 'pending',     -- 'pending' | 'fulfilled'
  fulfilled_at   TIMESTAMPTZ,
  fulfilled_by   TEXT
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  type            TEXT NOT NULL,
  -- payment_submitted | payment_approved | payment_rejected
  -- tag_updated | tag_requested
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  related_id      UUID,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ENABLE REALTIME ───────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE tags;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tag_requests;

-- ── ROW LEVEL SECURITY (optional but recommended) ─────────────────
-- Profiles: users can read all, update only their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Payments: authenticated users can read/insert
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read"   ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated USING (true);

-- Tags: everyone authenticated can read, only finance can write
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read"   ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tags_upsert" ON tags FOR INSERT TO authenticated WITH CHECK (true);

-- Tag history: read only
ALTER TABLE tag_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_history_read"   ON tag_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "tag_history_insert" ON tag_history FOR INSERT TO authenticated WITH CHECK (true);

-- Tag requests: authenticated
ALTER TABLE tag_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_requests_read"   ON tag_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "tag_requests_insert" ON tag_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tag_requests_update" ON tag_requests FOR UPDATE TO authenticated USING (true);

-- Notifications: users can read their own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read"   ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (true);
