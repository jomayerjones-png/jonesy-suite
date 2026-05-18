-- ============================================================
-- 002_add_rls_policies.sql
-- Enable Row Level Security on all client/data tables and add
-- user_id-based access policies so each authenticated user can
-- only see and modify their own rows.
--
-- Safe to run even if some tables don't exist yet — each block
-- catches "undefined_table" errors and skips gracefully.
-- ============================================================

-- Helper: applies all RLS steps for a single table.
-- If the table does not exist, the block is silently skipped.
CREATE OR REPLACE FUNCTION _apply_rls(tbl text) RETURNS void AS $$
BEGIN
  -- 1. Add user_id column
  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) DEFAULT auth.uid()',
    tbl
  );

  -- 2. Create index
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_%s_user_id ON %I (user_id)',
    replace(tbl, '.', '_'), tbl
  );

  -- 3. Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

  -- 4. Policies (drop + create for re-runnability)
  EXECUTE format('DROP POLICY IF EXISTS "users_select_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "users_select_%s" ON %I FOR SELECT USING (auth.uid() = user_id)',
    tbl, tbl
  );

  EXECUTE format('DROP POLICY IF EXISTS "users_insert_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "users_insert_%s" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
    tbl, tbl
  );

  EXECUTE format('DROP POLICY IF EXISTS "users_update_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "users_update_%s" ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
    tbl, tbl
  );

  EXECUTE format('DROP POLICY IF EXISTS "users_delete_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "users_delete_%s" ON %I FOR DELETE USING (auth.uid() = user_id)',
    tbl, tbl
  );

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table % does not exist — skipping', tbl;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Apply RLS to all known tables (skips any that don't exist)
-- ============================================================
BEGIN;

SELECT _apply_rls('jonesy_clients');
SELECT _apply_rls('jonesy_settings');
SELECT _apply_rls('jonesy_daily_prospects');

SELECT _apply_rls('clients');
SELECT _apply_rls('settings');
SELECT _apply_rls('daily_prospects');
SELECT _apply_rls('report_archives');

SELECT _apply_rls('status_clients');
SELECT _apply_rls('status_settings');
SELECT _apply_rls('status_report_archives');
SELECT _apply_rls('status_daily_prospects');

SELECT _apply_rls('kaleidoscope_clients');
SELECT _apply_rls('kaleidoscope_settings');
SELECT _apply_rls('kaleidoscope_report_archives');
SELECT _apply_rls('kaleidoscope_daily_prospects');

COMMIT;

-- Clean up helper function
DROP FUNCTION IF EXISTS _apply_rls(text);

-- ============================================================
-- Backfill: assign existing rows to your user.
-- Uncomment and replace <YOUR_USER_UUID> with your UUID from
-- Supabase → Authentication → Users.
-- ============================================================
-- BEGIN;
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
-- COMMIT;
