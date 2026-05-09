-- Postgres: enum value commit must precede using it elsewhere (run alone or first in chain).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'normal';
