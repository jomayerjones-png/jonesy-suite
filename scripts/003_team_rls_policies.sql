-- ============================================================
-- 003_team_rls_policies.sql
-- Upgrade from individual user_id RLS to TEAM-based access.
-- All members of a team can see/edit all rows in that team's
-- suite tables.
--
-- Safe to re-run — drops and recreates everything cleanly.
-- ============================================================

-- 1. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Team members table
CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Enable RLS on the team tables themselves
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Team members can read their own teams
DROP POLICY IF EXISTS "team_members_select" ON teams;
CREATE POLICY "team_members_select" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "team_members_select" ON team_members;
CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 3. Seed teams (idempotent)
INSERT INTO teams (name) VALUES ('jonesy')       ON CONFLICT (name) DO NOTHING;
INSERT INTO teams (name) VALUES ('life')          ON CONFLICT (name) DO NOTHING;
INSERT INTO teams (name) VALUES ('status')        ON CONFLICT (name) DO NOTHING;
INSERT INTO teams (name) VALUES ('kaleidoscope')  ON CONFLICT (name) DO NOTHING;
INSERT INTO teams (name) VALUES ('profg')         ON CONFLICT (name) DO NOTHING;

-- 4. Seed team members
-- Jonesy team
INSERT INTO team_members (team_id, user_id)
  SELECT t.id, '628951d8-466e-43b6-9188-9d16629c461c'::uuid
  FROM teams t WHERE t.name = 'jonesy'
  ON CONFLICT DO NOTHING;

-- LIFE team — Jo + Mimi
INSERT INTO team_members (team_id, user_id)
  SELECT t.id, '1cf871da-43cd-485a-bafd-716c8304e7c9'::uuid
  FROM teams t WHERE t.name = 'life'
  ON CONFLICT DO NOTHING;

INSERT INTO team_members (team_id, user_id)
  SELECT t.id, '5c49930f-1cad-4269-9edd-82ccc3a72644'::uuid
  FROM teams t WHERE t.name = 'life'
  ON CONFLICT DO NOTHING;

-- Status team
INSERT INTO team_members (team_id, user_id)
  SELECT t.id, '4c80bad6-ee40-40b5-af94-5cf2549e5506'::uuid
  FROM teams t WHERE t.name = 'status'
  ON CONFLICT DO NOTHING;

-- Kaleidoscope team
INSERT INTO team_members (team_id, user_id)
  SELECT t.id, 'd518e998-62b8-42ff-b55a-881141f82add'::uuid
  FROM teams t WHERE t.name = 'kaleidoscope'
  ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Replace individual RLS policies with team-based policies
-- ============================================================

CREATE OR REPLACE FUNCTION _apply_team_rls(tbl text, team_name text) RETURNS void AS $$
BEGIN
  -- Drop old individual policies
  EXECUTE format('DROP POLICY IF EXISTS "users_select_%s" ON %I', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "users_insert_%s" ON %I', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "users_update_%s" ON %I', tbl, tbl);
  EXECUTE format('DROP POLICY IF EXISTS "users_delete_%s" ON %I', tbl, tbl);

  -- SELECT: any team member can read all rows
  EXECUTE format('DROP POLICY IF EXISTS "team_select_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "team_select_%s" ON %I FOR SELECT USING (
      auth.uid() IN (
        SELECT tm.user_id FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE t.name = %L
      )
    )', tbl, tbl, team_name
  );

  -- INSERT: any team member can insert (user_id set to whoever inserts)
  EXECUTE format('DROP POLICY IF EXISTS "team_insert_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "team_insert_%s" ON %I FOR INSERT WITH CHECK (
      auth.uid() IN (
        SELECT tm.user_id FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE t.name = %L
      )
    )', tbl, tbl, team_name
  );

  -- UPDATE: any team member can update any row
  EXECUTE format('DROP POLICY IF EXISTS "team_update_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "team_update_%s" ON %I FOR UPDATE
      USING (
        auth.uid() IN (
          SELECT tm.user_id FROM team_members tm
          JOIN teams t ON t.id = tm.team_id
          WHERE t.name = %L
        )
      )
      WITH CHECK (
        auth.uid() IN (
          SELECT tm.user_id FROM team_members tm
          JOIN teams t ON t.id = tm.team_id
          WHERE t.name = %L
        )
      )', tbl, tbl, team_name, team_name
  );

  -- DELETE: any team member can delete
  EXECUTE format('DROP POLICY IF EXISTS "team_delete_%s" ON %I', tbl, tbl);
  EXECUTE format(
    'CREATE POLICY "team_delete_%s" ON %I FOR DELETE USING (
      auth.uid() IN (
        SELECT tm.user_id FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE t.name = %L
      )
    )', tbl, tbl, team_name
  );

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Table % does not exist — skipping', tbl;
END;
$$ LANGUAGE plpgsql;

-- Apply team policies to all suite tables
SELECT _apply_team_rls('jonesy_clients',    'jonesy');
SELECT _apply_team_rls('jonesy_settings',   'jonesy');
SELECT _apply_team_rls('jonesy_daily_prospects', 'jonesy');

SELECT _apply_team_rls('clients',           'life');
SELECT _apply_team_rls('settings',          'life');
SELECT _apply_team_rls('daily_prospects',   'life');
SELECT _apply_team_rls('report_archives',   'life');

SELECT _apply_team_rls('status_clients',         'status');
SELECT _apply_team_rls('status_settings',        'status');
SELECT _apply_team_rls('status_report_archives', 'status');
SELECT _apply_team_rls('status_daily_prospects', 'status');

SELECT _apply_team_rls('kaleidoscope_clients',         'kaleidoscope');
SELECT _apply_team_rls('kaleidoscope_settings',        'kaleidoscope');
SELECT _apply_team_rls('kaleidoscope_report_archives', 'kaleidoscope');
SELECT _apply_team_rls('kaleidoscope_daily_prospects', 'kaleidoscope');

-- Clean up
DROP FUNCTION IF EXISTS _apply_team_rls(text, text);

-- ============================================================
-- 6. Backfill: assign existing rows to a team member
-- ============================================================
UPDATE jonesy_clients    SET user_id = '628951d8-466e-43b6-9188-9d16629c461c' WHERE user_id IS NULL;
UPDATE jonesy_settings   SET user_id = '628951d8-466e-43b6-9188-9d16629c461c' WHERE user_id IS NULL;

UPDATE clients           SET user_id = '1cf871da-43cd-485a-bafd-716c8304e7c9' WHERE user_id IS NULL;
UPDATE settings          SET user_id = '1cf871da-43cd-485a-bafd-716c8304e7c9' WHERE user_id IS NULL;
UPDATE daily_prospects   SET user_id = '1cf871da-43cd-485a-bafd-716c8304e7c9' WHERE user_id IS NULL;
UPDATE report_archives   SET user_id = '1cf871da-43cd-485a-bafd-716c8304e7c9' WHERE user_id IS NULL;

UPDATE status_clients         SET user_id = '4c80bad6-ee40-40b5-af94-5cf2549e5506' WHERE user_id IS NULL;
UPDATE status_settings        SET user_id = '4c80bad6-ee40-40b5-af94-5cf2549e5506' WHERE user_id IS NULL;
UPDATE status_report_archives SET user_id = '4c80bad6-ee40-40b5-af94-5cf2549e5506' WHERE user_id IS NULL;
UPDATE status_daily_prospects SET user_id = '4c80bad6-ee40-40b5-af94-5cf2549e5506' WHERE user_id IS NULL;

UPDATE kaleidoscope_clients         SET user_id = 'd518e998-62b8-42ff-b55a-881141f82add' WHERE user_id IS NULL;
UPDATE kaleidoscope_settings        SET user_id = 'd518e998-62b8-42ff-b55a-881141f82add' WHERE user_id IS NULL;
UPDATE kaleidoscope_report_archives SET user_id = 'd518e998-62b8-42ff-b55a-881141f82add' WHERE user_id IS NULL;
UPDATE kaleidoscope_daily_prospects SET user_id = 'd518e998-62b8-42ff-b55a-881141f82add' WHERE user_id IS NULL;
