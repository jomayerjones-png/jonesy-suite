-- ============================================================
-- 005_digest_functions_and_cron.sql
-- RPC functions for the daily digest Edge Function + pg_cron
-- ============================================================

-- 1. Login summary for last 24h
CREATE OR REPLACE FUNCTION get_daily_logins()
RETURNS TABLE(email text, login_count bigint, last_login timestamptz)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    u.email::text,
    count(*)::bigint AS login_count,
    max(al.created_at) AS last_login
  FROM auth.audit_log_entries al
  JOIN auth.users u ON u.id = al.actor_id
  WHERE al.action = 'login'
    AND al.created_at >= now() - interval '24 hours'
  GROUP BY u.email
  ORDER BY login_count DESC;
$$;

-- 2. Data activity summary for last 24h
CREATE OR REPLACE FUNCTION get_daily_data_activity()
RETURNS TABLE(email text, suite text, action text, action_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    u.email::text,
    a.suite,
    a.action,
    count(*)::bigint AS action_count
  FROM activity_log a
  JOIN auth.users u ON u.id = a.user_id
  WHERE a.created_at >= now() - interval '24 hours'
  GROUP BY u.email, a.suite, a.action
  ORDER BY u.email, a.suite, a.action;
$$;

-- 3. Schedule daily digest at 8am ET (12:00 UTC)
-- Requires pg_cron extension (available on Supabase Pro)
-- This calls the Edge Function via pg_net
SELECT cron.schedule(
  'daily-usage-digest',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
