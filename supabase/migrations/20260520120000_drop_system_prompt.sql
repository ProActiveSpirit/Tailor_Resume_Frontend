-- Remove user-editable tailoring rules storage (replaced by server-fixed prompt).

ALTER TABLE public.profiles DROP COLUMN IF EXISTS system_prompt;
ALTER TABLE public.generation_logs DROP COLUMN IF EXISTS system_prompt;
