-- Prevent non-staff users from changing their own role via direct client updates.
-- Revoke RPC exposure of internal SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.enforce_profiles_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_app_staff() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'permission denied: cannot change role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_self_update_guard ON public.profiles;

CREATE TRIGGER profiles_self_update_guard
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profiles_self_update_guard();

-- RLS policies invoke these helpers during normal table access; authenticated
-- must retain EXECUTE. Revoke only from PUBLIC/anon to block unauthenticated RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_staff() TO authenticated;
