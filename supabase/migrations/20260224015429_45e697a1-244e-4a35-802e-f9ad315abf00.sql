
-- Step 1: Add 'owner' to enum and lifecycle columns only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text;
