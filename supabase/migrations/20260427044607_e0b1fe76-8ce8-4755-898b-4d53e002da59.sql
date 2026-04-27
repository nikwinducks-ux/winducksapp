ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS marketing_recipient text NOT NULL DEFAULT 'Winducks',
  ADD COLUMN IF NOT EXISTS marketing_recipient_name text NOT NULL DEFAULT '';