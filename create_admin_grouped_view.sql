-- Create a Grouped View to see Summary per User
-- Shows: Email, Total Minions Collected, and Last Collection Date

CREATE OR REPLACE VIEW public.admin_user_stats_view AS
SELECT 
  au.email,
  au.id as user_id,
  COUNT(um.minion_id) as total_collected,
  MAX(um.created_at) as last_collected_at
FROM auth.users au
LEFT JOIN public.user_minions um ON au.id = um.user_id
GROUP BY au.id, au.email
ORDER BY total_collected DESC;

-- Grant access
GRANT SELECT ON public.admin_user_stats_view TO authenticated;
GRANT SELECT ON public.admin_user_stats_view TO service_role;
