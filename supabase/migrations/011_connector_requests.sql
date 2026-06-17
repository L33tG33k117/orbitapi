CREATE TABLE connector_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_name TEXT NOT NULL,
  use_case TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE connector_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can insert connector_requests"
  ON connector_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.workspace_id = connector_requests.workspace_id
    )
  );

CREATE POLICY "workspace admins can read connector_requests"
  ON connector_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = auth.uid()
        AND memberships.workspace_id = connector_requests.workspace_id
        AND memberships.role IN ('owner', 'admin')
    )
  );
