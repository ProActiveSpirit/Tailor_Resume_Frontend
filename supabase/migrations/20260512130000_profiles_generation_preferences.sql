-- LLM / PDF preferences for resume generation (persisted per user; job description is not stored).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS llm_provider text,
  ADD COLUMN IF NOT EXISTS llm_model text,
  ADD COLUMN IF NOT EXISTS anthropic_max_tokens integer,
  ADD COLUMN IF NOT EXISTS claude_output_effort text,
  ADD COLUMN IF NOT EXISTS pdf_template text NOT NULL DEFAULT 'classic';

COMMENT ON COLUMN public.profiles.llm_provider IS 'openai | anthropic';
COMMENT ON COLUMN public.profiles.llm_model IS 'Model id override; null uses server env default';
COMMENT ON COLUMN public.profiles.anthropic_max_tokens IS 'Anthropic max output tokens (256–8192 in UI)';
COMMENT ON COLUMN public.profiles.claude_output_effort IS 'Anthropic effort hint when provider is anthropic';
COMMENT ON COLUMN public.profiles.pdf_template IS 'classic | minimal | structured | editorial';
