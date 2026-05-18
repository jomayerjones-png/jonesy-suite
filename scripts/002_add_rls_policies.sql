-- ============================================================
-- 002_add_rls_policies.sql
-- Enable Row Level Security on all client/data tables and add
-- user_id-based access policies so each authenticated user can
-- only see and modify their own rows.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Helper: list every table we want to protect.
-- If a table does not exist yet the ALTER / policy statements
-- will simply be skipped by the DO-block guards.
-- ────────────────────────────────────────────────────────────

BEGIN;

-- ============================================================
-- 1. Add user_id column (if missing) to every data table
-- ============================================================

ALTER TABLE IF EXISTS jonesy_clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS jonesy_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS daily_prospects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS report_archives
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS status_clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS status_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS status_report_archives
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS status_daily_prospects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS kaleidoscope_clients
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS kaleidoscope_settings
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS kaleidoscope_report_archives
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE IF EXISTS kaleidoscope_daily_prospects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid();


-- ============================================================
-- 2. Create indexes on user_id for query performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_jonesy_clients_user_id
  ON jonesy_clients (user_id);

CREATE INDEX IF NOT EXISTS idx_jonesy_settings_user_id
  ON jonesy_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id
  ON clients (user_id);

CREATE INDEX IF NOT EXISTS idx_settings_user_id
  ON settings (user_id);

CREATE INDEX IF NOT EXISTS idx_daily_prospects_user_id
  ON daily_prospects (user_id);

CREATE INDEX IF NOT EXISTS idx_report_archives_user_id
  ON report_archives (user_id);

CREATE INDEX IF NOT EXISTS idx_status_clients_user_id
  ON status_clients (user_id);

CREATE INDEX IF NOT EXISTS idx_status_settings_user_id
  ON status_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_status_report_archives_user_id
  ON status_report_archives (user_id);

CREATE INDEX IF NOT EXISTS idx_status_daily_prospects_user_id
  ON status_daily_prospects (user_id);

CREATE INDEX IF NOT EXISTS idx_kaleidoscope_clients_user_id
  ON kaleidoscope_clients (user_id);

CREATE INDEX IF NOT EXISTS idx_kaleidoscope_settings_user_id
  ON kaleidoscope_settings (user_id);

CREATE INDEX IF NOT EXISTS idx_kaleidoscope_report_archives_user_id
  ON kaleidoscope_report_archives (user_id);

CREATE INDEX IF NOT EXISTS idx_kaleidoscope_daily_prospects_user_id
  ON kaleidoscope_daily_prospects (user_id);


-- ============================================================
-- 3. Enable RLS on every table
--    (enabling RLS is idempotent -- safe to run if already on)
-- ============================================================

ALTER TABLE jonesy_clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE jonesy_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_prospects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_archives             ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_settings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_report_archives      ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_daily_prospects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaleidoscope_clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaleidoscope_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaleidoscope_report_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaleidoscope_daily_prospects ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. RLS Policies  (DROP + CREATE to make the script re-runnable)
-- ============================================================

-- ── jonesy_clients ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own jonesy_clients" ON jonesy_clients;
CREATE POLICY "Users can select own jonesy_clients" ON jonesy_clients
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own jonesy_clients" ON jonesy_clients;
CREATE POLICY "Users can insert own jonesy_clients" ON jonesy_clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jonesy_clients" ON jonesy_clients;
CREATE POLICY "Users can update own jonesy_clients" ON jonesy_clients
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own jonesy_clients" ON jonesy_clients;
CREATE POLICY "Users can delete own jonesy_clients" ON jonesy_clients
  FOR DELETE USING (auth.uid() = user_id);

-- ── jonesy_settings ─────────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own jonesy_settings" ON jonesy_settings;
CREATE POLICY "Users can select own jonesy_settings" ON jonesy_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own jonesy_settings" ON jonesy_settings;
CREATE POLICY "Users can insert own jonesy_settings" ON jonesy_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own jonesy_settings" ON jonesy_settings;
CREATE POLICY "Users can update own jonesy_settings" ON jonesy_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own jonesy_settings" ON jonesy_settings;
CREATE POLICY "Users can delete own jonesy_settings" ON jonesy_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ── clients (life-suite) ────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own clients" ON clients;
CREATE POLICY "Users can select own clients" ON clients
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
CREATE POLICY "Users can insert own clients" ON clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own clients" ON clients;
CREATE POLICY "Users can update own clients" ON clients
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own clients" ON clients;
CREATE POLICY "Users can delete own clients" ON clients
  FOR DELETE USING (auth.uid() = user_id);

-- ── settings (life-suite) ───────────────────────────────────

DROP POLICY IF EXISTS "Users can select own settings" ON settings;
CREATE POLICY "Users can select own settings" ON settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON settings;
CREATE POLICY "Users can insert own settings" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON settings;
CREATE POLICY "Users can update own settings" ON settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON settings;
CREATE POLICY "Users can delete own settings" ON settings
  FOR DELETE USING (auth.uid() = user_id);

-- ── daily_prospects (life-suite) ────────────────────────────

DROP POLICY IF EXISTS "Users can select own daily_prospects" ON daily_prospects;
CREATE POLICY "Users can select own daily_prospects" ON daily_prospects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own daily_prospects" ON daily_prospects;
CREATE POLICY "Users can insert own daily_prospects" ON daily_prospects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own daily_prospects" ON daily_prospects;
CREATE POLICY "Users can update own daily_prospects" ON daily_prospects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own daily_prospects" ON daily_prospects;
CREATE POLICY "Users can delete own daily_prospects" ON daily_prospects
  FOR DELETE USING (auth.uid() = user_id);

-- ── report_archives (life-suite) ────────────────────────────

DROP POLICY IF EXISTS "Users can select own report_archives" ON report_archives;
CREATE POLICY "Users can select own report_archives" ON report_archives
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own report_archives" ON report_archives;
CREATE POLICY "Users can insert own report_archives" ON report_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own report_archives" ON report_archives;
CREATE POLICY "Users can update own report_archives" ON report_archives
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own report_archives" ON report_archives;
CREATE POLICY "Users can delete own report_archives" ON report_archives
  FOR DELETE USING (auth.uid() = user_id);

-- ── status_clients ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own status_clients" ON status_clients;
CREATE POLICY "Users can select own status_clients" ON status_clients
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own status_clients" ON status_clients;
CREATE POLICY "Users can insert own status_clients" ON status_clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own status_clients" ON status_clients;
CREATE POLICY "Users can update own status_clients" ON status_clients
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own status_clients" ON status_clients;
CREATE POLICY "Users can delete own status_clients" ON status_clients
  FOR DELETE USING (auth.uid() = user_id);

-- ── status_settings ─────────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own status_settings" ON status_settings;
CREATE POLICY "Users can select own status_settings" ON status_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own status_settings" ON status_settings;
CREATE POLICY "Users can insert own status_settings" ON status_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own status_settings" ON status_settings;
CREATE POLICY "Users can update own status_settings" ON status_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own status_settings" ON status_settings;
CREATE POLICY "Users can delete own status_settings" ON status_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ── status_report_archives ──────────────────────────────────

DROP POLICY IF EXISTS "Users can select own status_report_archives" ON status_report_archives;
CREATE POLICY "Users can select own status_report_archives" ON status_report_archives
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own status_report_archives" ON status_report_archives;
CREATE POLICY "Users can insert own status_report_archives" ON status_report_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own status_report_archives" ON status_report_archives;
CREATE POLICY "Users can update own status_report_archives" ON status_report_archives
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own status_report_archives" ON status_report_archives;
CREATE POLICY "Users can delete own status_report_archives" ON status_report_archives
  FOR DELETE USING (auth.uid() = user_id);

-- ── status_daily_prospects ──────────────────────────────────

DROP POLICY IF EXISTS "Users can select own status_daily_prospects" ON status_daily_prospects;
CREATE POLICY "Users can select own status_daily_prospects" ON status_daily_prospects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own status_daily_prospects" ON status_daily_prospects;
CREATE POLICY "Users can insert own status_daily_prospects" ON status_daily_prospects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own status_daily_prospects" ON status_daily_prospects;
CREATE POLICY "Users can update own status_daily_prospects" ON status_daily_prospects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own status_daily_prospects" ON status_daily_prospects;
CREATE POLICY "Users can delete own status_daily_prospects" ON status_daily_prospects
  FOR DELETE USING (auth.uid() = user_id);

-- ── kaleidoscope_clients ────────────────────────────────────

DROP POLICY IF EXISTS "Users can select own kaleidoscope_clients" ON kaleidoscope_clients;
CREATE POLICY "Users can select own kaleidoscope_clients" ON kaleidoscope_clients
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kaleidoscope_clients" ON kaleidoscope_clients;
CREATE POLICY "Users can insert own kaleidoscope_clients" ON kaleidoscope_clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kaleidoscope_clients" ON kaleidoscope_clients;
CREATE POLICY "Users can update own kaleidoscope_clients" ON kaleidoscope_clients
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kaleidoscope_clients" ON kaleidoscope_clients;
CREATE POLICY "Users can delete own kaleidoscope_clients" ON kaleidoscope_clients
  FOR DELETE USING (auth.uid() = user_id);

-- ── kaleidoscope_settings ───────────────────────────────────

DROP POLICY IF EXISTS "Users can select own kaleidoscope_settings" ON kaleidoscope_settings;
CREATE POLICY "Users can select own kaleidoscope_settings" ON kaleidoscope_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kaleidoscope_settings" ON kaleidoscope_settings;
CREATE POLICY "Users can insert own kaleidoscope_settings" ON kaleidoscope_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kaleidoscope_settings" ON kaleidoscope_settings;
CREATE POLICY "Users can update own kaleidoscope_settings" ON kaleidoscope_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kaleidoscope_settings" ON kaleidoscope_settings;
CREATE POLICY "Users can delete own kaleidoscope_settings" ON kaleidoscope_settings
  FOR DELETE USING (auth.uid() = user_id);

-- ── kaleidoscope_report_archives ────────────────────────────

DROP POLICY IF EXISTS "Users can select own kaleidoscope_report_archives" ON kaleidoscope_report_archives;
CREATE POLICY "Users can select own kaleidoscope_report_archives" ON kaleidoscope_report_archives
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kaleidoscope_report_archives" ON kaleidoscope_report_archives;
CREATE POLICY "Users can insert own kaleidoscope_report_archives" ON kaleidoscope_report_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kaleidoscope_report_archives" ON kaleidoscope_report_archives;
CREATE POLICY "Users can update own kaleidoscope_report_archives" ON kaleidoscope_report_archives
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kaleidoscope_report_archives" ON kaleidoscope_report_archives;
CREATE POLICY "Users can delete own kaleidoscope_report_archives" ON kaleidoscope_report_archives
  FOR DELETE USING (auth.uid() = user_id);

-- ── kaleidoscope_daily_prospects ─────────────────────────────

DROP POLICY IF EXISTS "Users can select own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects;
CREATE POLICY "Users can select own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects;
CREATE POLICY "Users can insert own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects;
CREATE POLICY "Users can update own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects;
CREATE POLICY "Users can delete own kaleidoscope_daily_prospects" ON kaleidoscope_daily_prospects
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 5. Backfill: stamp existing rows with NULL user_id
--    (optional -- uncomment and set a specific user UUID to
--     assign existing data to a particular user)
-- ============================================================
-- UPDATE jonesy_clients            SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE jonesy_settings           SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE clients                   SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE settings                  SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE daily_prospects           SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE report_archives           SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE status_clients            SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE status_settings           SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE status_report_archives    SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE status_daily_prospects    SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE kaleidoscope_clients      SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE kaleidoscope_settings     SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE kaleidoscope_report_archives SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;
-- UPDATE kaleidoscope_daily_prospects SET user_id = '<YOUR_USER_UUID>' WHERE user_id IS NULL;

COMMIT;
