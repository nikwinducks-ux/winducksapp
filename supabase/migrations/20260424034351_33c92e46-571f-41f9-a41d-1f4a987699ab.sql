CREATE TABLE public.service_category_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  description text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_category_line_items_category_id ON public.service_category_line_items(category_id);

ALTER TABLE public.service_category_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access"
  ON public.service_category_line_items
  FOR ALL
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select active line items"
  ON public.service_category_line_items
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE TRIGGER update_service_category_line_items_updated_at
  BEFORE UPDATE ON public.service_category_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();