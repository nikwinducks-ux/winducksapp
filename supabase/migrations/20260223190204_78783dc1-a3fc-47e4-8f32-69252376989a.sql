
-- Add code column to service_categories
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT '';

-- Create unique index on code (only for non-empty codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_code_unique 
  ON public.service_categories (code) WHERE code != '';

-- Populate existing categories with codes
UPDATE public.service_categories SET code = 'wc' WHERE name = 'Window Cleaning';
UPDATE public.service_categories SET code = 'gc' WHERE name = 'Gutter Cleaning';
UPDATE public.service_categories SET code = 'pw' WHERE name = 'Pressure Washing';
UPDATE public.service_categories SET code = 'hw' WHERE name = 'House Wash';
UPDATE public.service_categories SET code = 'cl' WHERE name = 'Christmas Lights';
