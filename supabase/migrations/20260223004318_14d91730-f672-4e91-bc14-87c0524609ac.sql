
-- Create service_categories table
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to service_categories"
ON public.service_categories FOR ALL
USING (true) WITH CHECK (true);

-- Add notes and urgency columns to jobs
ALTER TABLE public.jobs
ADD COLUMN notes TEXT NOT NULL DEFAULT '',
ADD COLUMN urgency TEXT NOT NULL DEFAULT 'Scheduled';

-- Seed starter categories
INSERT INTO public.service_categories (name, display_order) VALUES
  ('Window Cleaning', 1),
  ('Gutter Cleaning', 2),
  ('Pressure Washing', 3),
  ('House Wash', 4),
  ('Commercial Window Cleaning', 5),
  ('Screen Cleaning', 6);
