-- Create a Grouped List View
-- Shows: Email, Count, and a comma-separated list of all Minion Names

CREATE OR REPLACE VIEW public.admin_user_full_list_view AS
SELECT 
  au.email,
  COUNT(um.minion_id) as total_collected,
  STRING_AGG(m.name, ', ' ORDER BY m.name) as minions_list
FROM auth.users au
JOIN public.user_minions um ON au.id = um.user_id
JOIN public.minions m ON um.minion_id = m.id
GROUP BY au.id, au.email
ORDER BY total_collected DESC;

-- Grant access
GRANT SELECT ON public.admin_user_full_list_view TO authenticated;
GRANT SELECT ON public.admin_user_full_list_view TO service_role;
