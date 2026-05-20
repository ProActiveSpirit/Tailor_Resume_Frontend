-- Restore EXECUTE for authenticated on RLS helper functions.
-- profiles_select_own_or_admin and related policies call is_app_staff() /
-- is_app_admin() on every query; revoking from authenticated breaks reads.

REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_staff() TO authenticated;
