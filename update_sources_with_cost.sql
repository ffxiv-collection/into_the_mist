-- 1. Create CURRENCIES table
create table if not exists public.currencies (
    id bigint generated always as identity primary key,
    name text not null,        -- e.g. "Gil", "MGP", "Euro"
    icon_url text,             -- e.g. "https://xivapi.com/i/065000/065002.png"
    created_at timestamptz default now()
);

-- RLS
alter table public.currencies enable row level security;
create policy "Public Read Currencies" on public.currencies for select using (true);

-- 2. Insert Default Currencies
insert into public.currencies (name, icon_url) values 
('Gil', 'https://xivapi.com/i/065000/065002.png'),
('MGP', 'https://xivapi.com/i/065000/065025.png'), -- MGP Coin
('Euro', 'fa-solid fa-euro-sign'),                 -- FontAwesome for Euro
('Poetic', 'https://xivapi.com/i/065000/065023.png'), -- Allagan Tomestone
('Sacks', 'https://xivapi.com/i/065000/065034.png'); -- Sack of Nuts etc (generic)

-- 3. Update minion_sources to include cost
alter table public.minion_sources 
add column if not exists cost integer,
add column if not exists currency_id bigint references public.currencies(id) on delete set null;

-- Example: Link Aerith source to Euro currency with cost 6
-- do $$
-- declare
--   v_euro_id bigint;
--   v_boutique_id bigint;
-- begin
--   select id into v_euro_id from currencies where name = 'Euro' limit 1;
--   select id into v_boutique_id from sources where name = 'Boutique' limit 1;
--   
--   update minion_sources 
--   set cost = 6, currency_id = v_euro_id 
--   where source_id = v_boutique_id; 
-- end $$;
