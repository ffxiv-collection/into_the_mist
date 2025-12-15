-- Enable RLS on minions table (if not already)
ALTER TABLE minions ENABLE ROW LEVEL SECURITY;

-- Allow Select for Everyone (Anon + Authenticated)
CREATE POLICY "Public Read Minions"
ON minions
FOR SELECT
USING (true);

-- Just in case, grant usage
GRANT SELECT ON minions TO anon, authenticated;
