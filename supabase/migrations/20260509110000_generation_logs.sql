-- Per-generation audit trail: prompts, model settings, token usage (admin-readable).

CREATE TABLE public.generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  system_prompt text NOT NULL,
  job_description text NOT NULL,
  source_resume text NOT NULL,
  display_name text NOT NULL,
  target_role text NOT NULL,
  phone text,
  pdf_template text NOT NULL DEFAULT 'classic',
  anthropic_model text,
  anthropic_max_tokens integer,
  claude_output_effort text,
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer,
  cache_read_input_tokens integer,
  estimated_cost_usd numeric(12, 6),
  api_key_source text NOT NULL DEFAULT 'server_environment'
);

COMMENT ON TABLE public.generation_logs IS 'Successful resume generations; prompts and usage for admin review.';

CREATE INDEX generation_logs_created_at_desc ON public.generation_logs (created_at DESC);

ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generation_logs_insert_own"
ON public.generation_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "generation_logs_select_admin"
ON public.generation_logs
FOR SELECT
TO authenticated
USING (public.is_app_admin());
