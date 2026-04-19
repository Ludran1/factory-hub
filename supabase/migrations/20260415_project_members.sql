-- =============================================
-- PROJECT MEMBERS
-- Asignación explícita de usuarios a proyectos con rol (owner/contributor).
-- Complementa la derivación implícita por tareas asignadas.
-- =============================================

DO $$ BEGIN
  CREATE TYPE project_member_role AS ENUM ('owner', 'contributor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role project_member_role NOT NULL DEFAULT 'contributor',
  added_at timestamptz DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_profile_idx ON project_members(profile_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read project members" ON project_members;
CREATE POLICY "Authenticated can read project members"
  ON project_members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and developers can manage project members" ON project_members;
CREATE POLICY "Admins and developers can manage project members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'developer')
    )
  );
