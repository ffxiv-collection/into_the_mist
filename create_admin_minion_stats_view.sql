-- Create a View Grouped by MINION (Popularity Check)
-- Shows: Minion Name, How many people possess it, and Who (emails)

CREATE OR REPLACE VIEW public.admin_minion_stats_view AS
SELECT 
  m.id,
  m.name as minion_name,
  COUNT(um.user_id) as total_owners,
  STRING_AGG(au.email, ', ' ORDER BY au.email) as owners_list
FROM public.minions m
LEFT JOIN public.user_minions um ON m.id = um.minion_id
LEFT JOIN auth.users au ON um.user_id = au.id
GROUP BY m.id, m.name
ORDER BY total_owners DESC, m.name ASC;

-- Grant access
GRANT SELECT ON public.admin_minion_stats_view TO authenticated;
GRANT SELECT ON public.admin_minion_stats_view TO service_role;
