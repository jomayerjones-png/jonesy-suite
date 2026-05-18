-- ============================================================
-- 004_activity_tracking.sql
-- Track user data activity across all suites for daily digest.
-- Logins are already tracked via auth.audit_log (built-in).
-- ============================================================

-- 1. Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  suite text NOT NULL,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  summary text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log (user_id, created_at DESC);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_activity" ON activity_log;
CREATE POLICY "admin_read_activity" ON activity_log
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "system_insert_activity" ON activity_log;
CREATE POLICY "system_insert_activity" ON activity_log
  FOR INSERT WITH CHECK (true);

-- 2. Generic trigger function
CREATE OR REPLACE FUNCTION log_data_activity() RETURNS trigger AS $$
DECLARE
  v_suite text;
  v_record_id text;
  v_summary text;
  v_user_id uuid;
BEGIN
  -- Determine suite from table name
  v_suite := CASE
    WHEN TG_TABLE_NAME LIKE 'jonesy_%' THEN 'jonesy'
    WHEN TG_TABLE_NAME LIKE 'status_%' THEN 'status'
    WHEN TG_TABLE_NAME LIKE 'kaleidoscope_%' THEN 'kaleidoscope'
    ELSE 'life'
  END;

  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id::text;
    v_user_id := OLD.user_id;
    v_summary := 'Deleted record';
  ELSE
    v_record_id := NEW.id::text;
    v_user_id := COALESCE(NEW.user_id, auth.uid());
    IF TG_OP = 'INSERT' THEN
      v_summary := 'Created new record';
    ELSE
      v_summary := 'Updated record';
    END IF;
  END IF;

  INSERT INTO activity_log (user_id, suite, table_name, action, record_id, summary)
  VALUES (v_user_id, v_suite, TG_TABLE_NAME, TG_OP, v_record_id, v_summary);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to all data tables
CREATE OR REPLACE FUNCTION _attach_activity_trigger(tbl text) RETURNS void AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_activity_%s ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE TRIGGER trg_activity_%s AFTER INSERT OR UPDATE OR DELETE ON %I
     FOR EACH ROW EXECUTE FUNCTION log_data_activity()',
    tbl, tbl
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table % does not exist — skipping trigger', tbl;
END;
$$ LANGUAGE plpgsql;

SELECT _attach_activity_trigger('jonesy_clients');
SELECT _attach_activity_trigger('jonesy_settings');
SELECT _attach_activity_trigger('jonesy_daily_prospects');

SELECT _attach_activity_trigger('clients');
SELECT _attach_activity_trigger('settings');
SELECT _attach_activity_trigger('daily_prospects');
SELECT _attach_activity_trigger('report_archives');

SELECT _attach_activity_trigger('status_clients');
SELECT _attach_activity_trigger('status_settings');
SELECT _attach_activity_trigger('status_report_archives');
SELECT _attach_activity_trigger('status_daily_prospects');

SELECT _attach_activity_trigger('kaleidoscope_clients');
SELECT _attach_activity_trigger('kaleidoscope_settings');
SELECT _attach_activity_trigger('kaleidoscope_report_archives');
SELECT _attach_activity_trigger('kaleidoscope_daily_prospects');

DROP FUNCTION IF EXISTS _attach_activity_trigger(text);

-- 4. Daily digest view (combines logins + data activity for last 24h)
CREATE OR REPLACE VIEW daily_usage_digest AS
WITH login_activity AS (
  SELECT
    u.email,
    'login' AS activity_type,
    NULL AS suite,
    'auth' AS table_name,
    'LOGIN' AS action,
    al.created_at
  FROM auth.audit_log_entries al
  JOIN auth.users u ON u.id = al.actor_id
  WHERE al.action = 'login'
    AND al.created_at >= now() - interval '24 hours'
),
data_activity AS (
  SELECT
    u.email,
    'data' AS activity_type,
    a.suite,
    a.table_name,
    a.action,
    a.created_at
  FROM activity_log a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= now() - interval '24 hours'
)
SELECT * FROM login_activity
UNION ALL
SELECT * FROM data_activity
ORDER BY created_at DESC;

-- 5. Summary view for the email digest
CREATE OR REPLACE VIEW daily_digest_summary AS
WITH logins AS (
  SELECT
    u.email,
    count(*) AS login_count,
    max(al.created_at) AS last_login
  FROM auth.audit_log_entries al
  JOIN auth.users u ON u.id = al.actor_id
  WHERE al.action = 'login'
    AND al.created_at >= now() - interval '24 hours'
  GROUP BY u.email
),
data_changes AS (
  SELECT
    u.email,
    a.suite,
    a.action,
    count(*) AS action_count
  FROM activity_log a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= now() - interval '24 hours'
  GROUP BY u.email, a.suite, a.action
)
SELECT
  COALESCE(l.email, d.email) AS email,
  COALESCE(l.login_count, 0) AS logins_24h,
  l.last_login,
  d.suite,
  d.action,
  COALESCE(d.action_count, 0) AS changes
FROM logins l
FULL OUTER JOIN data_changes d ON l.email = d.email
ORDER BY email, suite, action;
