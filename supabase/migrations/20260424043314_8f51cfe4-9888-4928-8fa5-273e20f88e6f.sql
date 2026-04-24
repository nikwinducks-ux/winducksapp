
-- ============================================================================
-- 1. Extend customers table
-- ============================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS display_as text NOT NULL DEFAULT 'person';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_display_as_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_display_as_check CHECK (display_as IN ('person', 'company'));

-- Backfill first/last name from existing 'name' for rows where new fields are empty
UPDATE public.customers
SET
  first_name = CASE
    WHEN first_name = '' AND name <> '' THEN split_part(name, ' ', 1)
    ELSE first_name
  END,
  last_name = CASE
    WHEN last_name = '' AND name <> '' AND position(' ' in name) > 0
      THEN btrim(substring(name from position(' ' in name) + 1))
    ELSE last_name
  END
WHERE first_name = '' OR last_name = '';

-- ============================================================================
-- 2. Customer properties (multiple addresses per customer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Primary',
  is_primary boolean NOT NULL DEFAULT false,
  address_street text NOT NULL DEFAULT '',
  address_city text NOT NULL DEFAULT '',
  address_region text NOT NULL DEFAULT '',
  address_postal text NOT NULL DEFAULT '',
  address_country text NOT NULL DEFAULT 'Canada',
  address_lat double precision,
  address_lng double precision,
  notes text NOT NULL DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_properties_customer_id ON public.customer_properties(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_properties_one_primary
  ON public.customer_properties(customer_id) WHERE is_primary;

ALTER TABLE public.customer_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.customer_properties;
CREATE POLICY "Admin full access" ON public.customer_properties
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select properties of assigned jobs" ON public.customer_properties;
CREATE POLICY "SP select properties of assigned jobs" ON public.customer_properties
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT j.customer_id FROM public.jobs j
      WHERE j.customer_id IS NOT NULL
        AND (j.assigned_sp_id = get_user_sp_id(auth.uid()) OR sp_on_job_crew(get_user_sp_id(auth.uid()), j.id))
    )
  );

CREATE TRIGGER customer_properties_updated_at
  BEFORE UPDATE ON public.customer_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: one property per existing customer from current address fields
INSERT INTO public.customer_properties
  (customer_id, label, is_primary, address_street, address_city, address_region,
   address_postal, address_country, address_lat, address_lng)
SELECT
  c.id, 'Primary', true,
  c.address_street, c.address_city, c.address_region, c.address_postal,
  c.address_country, c.address_lat, c.address_lng
FROM public.customers c
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_properties cp WHERE cp.customer_id = c.id
);

-- ============================================================================
-- 3. Customer contacts (additional people)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.customer_contacts;
CREATE POLICY "Admin full access" ON public.customer_contacts
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select contacts of assigned jobs" ON public.customer_contacts;
CREATE POLICY "SP select contacts of assigned jobs" ON public.customer_contacts
  FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT j.customer_id FROM public.jobs j
      WHERE j.customer_id IS NOT NULL
        AND (j.assigned_sp_id = get_user_sp_id(auth.uid()) OR sp_on_job_crew(get_user_sp_id(auth.uid()), j.id))
    )
  );

CREATE TRIGGER customer_contacts_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. Customer tag catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'primary',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_tags
  DROP CONSTRAINT IF EXISTS customer_tags_color_check;
ALTER TABLE public.customer_tags
  ADD CONSTRAINT customer_tags_color_check
  CHECK (color IN ('primary', 'accent', 'success', 'warning', 'destructive', 'neutral'));

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.customer_tags;
CREATE POLICY "Admin full access" ON public.customer_tags
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read tags" ON public.customer_tags;
CREATE POLICY "Authenticated read tags" ON public.customer_tags
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER customer_tags_updated_at
  BEFORE UPDATE ON public.customer_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed previously hard-coded tags
INSERT INTO public.customer_tags (name, color, display_order) VALUES
  ('VIP', 'warning', 1),
  ('Recurring', 'success', 2),
  ('Commercial', 'primary', 3),
  ('Residential', 'accent', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 5. Jobs: link to a specific customer property (optional)
-- ============================================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_property_id uuid REFERENCES public.customer_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_customer_property_id ON public.jobs(customer_property_id);

-- Backfill: link existing jobs to their customer's primary property
UPDATE public.jobs j
SET customer_property_id = cp.id
FROM public.customer_properties cp
WHERE j.customer_property_id IS NULL
  AND j.customer_id IS NOT NULL
  AND cp.customer_id = j.customer_id
  AND cp.is_primary = true;

-- ============================================================================
-- 6. Sync triggers — keep customers.name and address_* in sync
-- ============================================================================

-- Keep customers.name auto-derived from first/last/company + display_as
CREATE OR REPLACE FUNCTION public.sync_customer_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _person text;
  _company text;
BEGIN
  _person := btrim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''));
  _company := btrim(coalesce(NEW.company_name, ''));

  IF NEW.display_as = 'company' AND _company <> '' THEN
    NEW.name := _company;
  ELSIF _person <> '' THEN
    NEW.name := _person;
  ELSIF _company <> '' THEN
    NEW.name := _company;
  ELSIF coalesce(NEW.name, '') = '' THEN
    NEW.name := 'Unnamed customer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_name_trigger ON public.customers;
CREATE TRIGGER sync_customer_name_trigger
  BEFORE INSERT OR UPDATE OF first_name, last_name, company_name, display_as
  ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_name();

-- Keep customers.address_* mirrored from primary property (back-compat)
CREATE OR REPLACE FUNCTION public.sync_customer_primary_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cid uuid;
  _p RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _cid := OLD.customer_id;
  ELSE
    _cid := NEW.customer_id;
  END IF;

  -- Find current primary (or first) property
  SELECT * INTO _p
    FROM public.customer_properties
   WHERE customer_id = _cid
   ORDER BY is_primary DESC, display_order ASC, created_at ASC
   LIMIT 1;

  IF _p.id IS NULL THEN
    UPDATE public.customers SET
      address_street = '', address_city = '', address_region = '',
      address_postal = '', address_country = 'Canada',
      address_lat = NULL, address_lng = NULL
    WHERE id = _cid;
  ELSE
    UPDATE public.customers SET
      address_street = _p.address_street,
      address_city = _p.address_city,
      address_region = _p.address_region,
      address_postal = _p.address_postal,
      address_country = _p.address_country,
      address_lat = _p.address_lat,
      address_lng = _p.address_lng
    WHERE id = _cid;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_customer_primary_address_trigger ON public.customer_properties;
CREATE TRIGGER sync_customer_primary_address_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_primary_address();

-- ============================================================================
-- 7. Activity log triggers for new tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_log_customer_properties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_customer_activity(
      NEW.customer_id, NULL, 'property_added',
      'Property added: ' || COALESCE(NULLIF(NEW.label,''), 'Property'),
      jsonb_build_object('label', NEW.label, 'street', NEW.address_street, 'city', NEW.address_city, 'is_primary', NEW.is_primary)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public._log_customer_activity(
      NEW.customer_id, NULL, 'property_updated',
      'Property updated: ' || COALESCE(NULLIF(NEW.label,''), 'Property'),
      jsonb_build_object(
        'from', jsonb_build_object('label', OLD.label, 'street', OLD.address_street, 'city', OLD.address_city, 'is_primary', OLD.is_primary),
        'to', jsonb_build_object('label', NEW.label, 'street', NEW.address_street, 'city', NEW.address_city, 'is_primary', NEW.is_primary)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._log_customer_activity(
      OLD.customer_id, NULL, 'property_removed',
      'Property removed: ' || COALESCE(NULLIF(OLD.label,''), 'Property'),
      jsonb_build_object('label', OLD.label, 'street', OLD.address_street, 'city', OLD.address_city)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_log_customer_properties_trigger ON public.customer_properties;
CREATE TRIGGER tg_log_customer_properties_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_properties
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_customer_properties();

CREATE OR REPLACE FUNCTION public.tg_log_customer_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_customer_activity(
      NEW.customer_id, NULL, 'contact_added',
      'Contact added: ' || COALESCE(NULLIF(NEW.name,''), 'Contact'),
      jsonb_build_object('name', NEW.name, 'role', NEW.role, 'phone', NEW.phone, 'email', NEW.email)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public._log_customer_activity(
      NEW.customer_id, NULL, 'contact_updated',
      'Contact updated: ' || COALESCE(NULLIF(NEW.name,''), 'Contact'),
      jsonb_build_object(
        'from', jsonb_build_object('name', OLD.name, 'role', OLD.role, 'phone', OLD.phone, 'email', OLD.email),
        'to', jsonb_build_object('name', NEW.name, 'role', NEW.role, 'phone', NEW.phone, 'email', NEW.email)
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public._log_customer_activity(
      OLD.customer_id, NULL, 'contact_removed',
      'Contact removed: ' || COALESCE(NULLIF(OLD.name,''), 'Contact'),
      jsonb_build_object('name', OLD.name, 'role', OLD.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_log_customer_contacts_trigger ON public.customer_contacts;
CREATE TRIGGER tg_log_customer_contacts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_customer_contacts();
