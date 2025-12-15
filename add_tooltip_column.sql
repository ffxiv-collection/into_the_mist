-- Add lodestone_url column for Eorzea Database links
ALTER TABLE public.minion_sources 
ADD COLUMN IF NOT EXISTS lodestone_url text;

-- Comment on column
COMMENT ON COLUMN public.minion_sources.lodestone_url IS 'URL for the official Eorzea Database tooltip (starts with https://fr.finalfantasyxiv.com/...)';
