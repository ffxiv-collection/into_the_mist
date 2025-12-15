-- Add a text column for acquisition method (e.g. "Shop: 5.99€")
alter table public.minions add column if not exists acquisition text;

-- Add a text column for the shop URL (e.g. "https://store.finalfantasyxiv.com/...")
alter table public.minions add column if not exists shop_url text;

-- Example update for Aerith (Optional demo data)
-- update public.minions 
-- set acquisition = 'Achat boutique officielle (5,99 €)',
--     shop_url = 'https://store.finalfantasyxiv.com/ffxivstore/fr-fr/product/123' 
-- where name ilike '%Aerith%';
