-- Force add columns if they are missing (safety fix)
ALTER TABLE public.sources 
ADD COLUMN IF NOT EXISTS icon_url text;

ALTER TABLE public.currencies
ADD COLUMN IF NOT EXISTS icon_url text;

-- Verify/Fix types just in case
-- ALTER TABLE public.minion_sources 
-- ALTER COLUMN cost TYPE numeric(10, 2);
