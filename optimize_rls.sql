-- Optimize RLS policies to evaluate auth.uid() once per statement
-- Performance improvement based on scalar subquery pattern: (SELECT auth.uid())

-- 1. Optimize "Users can view own collection" (SELECT)
ALTER POLICY "Users can view own collection" ON public.user_minions
USING ( (SELECT auth.uid()) = user_id );

-- 2. Optimize "Users can remove from own collection" (DELETE)
ALTER POLICY "Users can remove from own collection" ON public.user_minions
USING ( (SELECT auth.uid()) = user_id );

-- 3. Optimize "Users can add to own collection" (INSERT)
ALTER POLICY "Users can add to own collection" ON public.user_minions
WITH CHECK ( (SELECT auth.uid()) = user_id );
