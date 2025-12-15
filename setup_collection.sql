-- Create the join table
create table public.user_minions (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) not null,
  minion_id bigint references public.minions(id) not null,
  created_at timestamptz default now(),
  
  -- Prevent duplicate entries (user can't collect the same minion twice)
  unique(user_id, minion_id)
);

-- Enable RLS
alter table public.user_minions enable row level security;

-- Policies

-- 1. View: Users can see only their own collection
create policy "Users can view own collection"
on public.user_minions for select
using ( auth.uid() = user_id );

-- 2. Insert: Users can add to their own collection
create policy "Users can add to own collection"
on public.user_minions for insert
with check ( auth.uid() = user_id );

-- 3. Delete: Users can remove from their own collection
create policy "Users can remove from own collection"
on public.user_minions for delete
using ( auth.uid() = user_id );

