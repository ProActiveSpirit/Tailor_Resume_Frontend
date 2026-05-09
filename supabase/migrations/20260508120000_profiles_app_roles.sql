-- App roles (developer | admin) + one profile per auth user.
-- Apply with: Supabase Dashboard → SQL Editor, or `supabase db push` / `supabase migration up`.

CREATE TYPE public.app_role AS ENUM ('developer', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  role public.app_role NOT NULL DEFAULT 'developer',
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'One row per auth user; role drives admin UX.';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email::text, 'developer');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

INSERT INTO public.profiles (id, email, role)
SELECT id, email::text, 'developer'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, role)
SELECT id, email::text, 'admin'
FROM auth.users
WHERE lower(email) = lower('Ricca.Thomas@outlook.com')
ON CONFLICT (id) DO UPDATE SET
  role = excluded.role,
  email = excluded.email,
  updated_at = now();
