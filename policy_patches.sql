-- Enable RLS on patches table
ALTER TABLE patches ENABLE ROW LEVEL SECURITY;

-- Allow Select for Everyone
CREATE POLICY "Public Read Patches"
ON patches
FOR SELECT
USING (true);

GRANT SELECT ON patches TO anon, authenticated;
