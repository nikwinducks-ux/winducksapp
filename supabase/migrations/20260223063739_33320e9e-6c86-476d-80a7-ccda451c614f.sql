
-- Add broadcast fields to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS broadcast_radius_km integer NOT NULL DEFAULT 100;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS broadcast_note text NOT NULL DEFAULT '';
