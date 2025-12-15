-- FIX: Remove the incorrect unique constraint that limits users to 1 minion total
ALTER TABLE public.user_minions DROP CONSTRAINT IF EXISTS user_minions_user_id_key;

-- FIX: Add the correct constraint allowing 1 entry per MINION per USER
-- This makes the combination of user+minion unique, not just the user.
ALTER TABLE public.user_minions ADD CONSTRAINT user_minions_user_id_minion_id_key UNIQUE (user_id, minion_id);
