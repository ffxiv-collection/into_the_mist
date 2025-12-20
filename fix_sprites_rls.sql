-- Fix Security Advisor Error: RLS Disabled in Public on public.sprites
-- Enable RLS
ALTER TABLE public.sprites ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Select) for everyone
DROP POLICY IF EXISTS "Public Read Sprites" ON public.sprites;

CREATE POLICY "Public Read Sprites"
ON public.sprites
FOR SELECT
USING (true);
