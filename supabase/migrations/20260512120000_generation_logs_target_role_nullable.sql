-- Allow inserts without target role (field removed from generation form).
ALTER TABLE public.generation_logs
  ALTER COLUMN target_role DROP NOT NULL,
  ALTER COLUMN target_role SET DEFAULT NULL;
