ALTER TABLE public.service_category_line_items
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

UPDATE public.service_category_line_items
   SET title = description
 WHERE title = '' AND description IS NOT NULL;