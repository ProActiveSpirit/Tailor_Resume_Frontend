-- Staff (admin | developer) can SELECT/UPDATE any profile for Members UI.
-- Bootstrap andrewgrandyer@outlook.com as admin; demote previous seed admin if present.

CREATE OR REPLACE FUNCTION public.is_app_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin'::public.app_role, 'developer'::public.app_role)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_staff() TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_app_staff());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_app_staff())
WITH CHECK (public.is_app_staff());

INSERT INTO public.profiles (id, email, role)
SELECT id, email::text, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('andrewgrandyer@outlook.com')
ON CONFLICT (id) DO UPDATE SET
  role = excluded.role,
  email = excluded.email,
  updated_at = now();

UPDATE public.profiles
SET role = 'developer'::public.app_role, updated_at = now()
WHERE lower(email) = lower('Ricca.Thomas@outlook.com')
  AND role = 'admin'::public.app_role;
