-- Enable RLS on currencies table (if not already)
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Public Read Currencies" ON public.currencies;

-- Create a policy that allows everyone (anon and authenticated) to read
CREATE POLICY "Public Read Currencies" 
ON public.currencies 
FOR SELECT 
USING (true);

-- Also ensure 'sources' has the same (just in case)
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Sources" ON public.sources;
CREATE POLICY "Public Read Sources" 
ON public.sources 
FOR SELECT 
USING (true);
