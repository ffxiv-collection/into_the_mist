-- 1. Create SOURCES table (Lieux d'obtention)
create table if not exists public.sources (
    id bigint generated always as identity primary key,
    name text not null,        -- e.g. "Donjon", "Boutique", "Raid"
    type text,                 -- Optional category
    icon_url text,             -- Image URL or FontAwesome class
    created_at timestamptz default now()
);

-- 2. Create MINION_SOURCES table (Lien Mascotte <-> Source)
create table if not exists public.minion_sources (
    id bigint generated always as identity primary key,
    minion_id bigint references public.minions(id) on delete cascade not null,
    source_id bigint references public.sources(id) on delete cascade not null,
    details text,              -- e.g. "Sastasha (Brutal)" or "5.99€"
    created_at timestamptz default now()
);

-- 3. RLS Policies
alter table public.sources enable row level security;
alter table public.minion_sources enable row level security;

create policy "Public Read Sources" on public.sources for select using (true);
create policy "Public Read Minion Sources" on public.minion_sources for select using (true);

-- 4. Insert Default Data (With user's icons)
-- Donjon (User provided specific icon)
insert into public.sources (name, icon_url) 
values ('Donjon', 'https://res.cloudinary.com/dd4rdtrig/image/upload/v1765724987/other_donjon_asbn9q.webp');

-- Boutique (Using FontAwesome class as placeholder, or we can use an image if preferred)
-- Logic in app.js will handle "http" vs "fa-" detection
insert into public.sources (name, icon_url) 
values ('Boutique', 'fa-solid fa-cart-shopping');

-- Raid
insert into public.sources (name, icon_url) 
values ('Raid', 'fa-solid fa-dungeon');

-- Quête
insert into public.sources (name, icon_url) 
values ('Quête', 'fa-solid fa-scroll');

-- Craft
insert into public.sources (name, icon_url) 
values ('Craft', 'fa-solid fa-hammer');

-- Achievement
insert into public.sources (name, icon_url) 
values ('Haut Fait', 'fa-solid fa-trophy');

-- PvP
insert into public.sources (name, icon_url) 
values ('PvP', 'fa-solid fa-swords');


-- 5. Example Data Connection (Aerith -> Boutique)
-- Assuming Aerith exists and Boutique is ID 2 (based on insertion order above)
-- You will need to look up IDs in reality, but this is a template.

-- do $$
-- declare
--   v_boutique_id bigint;
--   v_aerith_id bigint;
-- begin
--   select id into v_boutique_id from sources where name = 'Boutique' limit 1;
--   select id into v_aerith_id from minions where name ilike '%Aerith%' limit 1;
--   
--   if v_aerith_id is not null then
--     insert into minion_sources (minion_id, source_id, details)
--     values (v_aerith_id, v_boutique_id, '5.99€');
--   end if;
-- end $$;
