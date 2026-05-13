-- Optional LinkedIn URL for resume contact (editable on profile).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS linkedin text;
