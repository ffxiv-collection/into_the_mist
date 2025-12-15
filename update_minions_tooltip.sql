-- Add a text column for the minion's in-game tooltip/quote
alter table public.minions add column if not exists tooltip text;

-- Example:
-- update public.minions 
-- set tooltip = 'Il ne faut pas se fier à son air innocent...'
-- where name ilike '%Aerith%';
