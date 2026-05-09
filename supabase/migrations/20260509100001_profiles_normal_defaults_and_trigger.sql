ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'normal';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email::text, 'normal'::public.app_role);
  RETURN NEW;
END;
$$;
