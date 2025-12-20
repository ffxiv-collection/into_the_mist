-- Create a View to easily see/search User Minions with Email
-- This acts like a table but is dynamic (no data duplication issues)

CREATE OR REPLACE VIEW public.admin_user_minions_view AS
SELECT 
  um.id,
  um.minion_id,
  m.name as minion_name,
  um.created_at,
  um.user_id,
  au.email
FROM public.user_minions um
JOIN auth.users au ON um.user_id = au.id
JOIN public.minions m ON um.minion_id = m.id;

-- Grant access to authenticated users (adjust as needed, maybe strictly for service_role/admins)
-- For now, allowing read so you can see it in dashboard
GRANT SELECT ON public.admin_user_minions_view TO authenticated;
GRANT SELECT ON public.admin_user_minions_view TO service_role;
