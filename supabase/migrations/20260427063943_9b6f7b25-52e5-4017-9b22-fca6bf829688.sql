-- =========================================================
-- ESTIMATES MODULE
-- =========================================================

-- Add estimate counter to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS next_estimate_number integer NOT NULL DEFAULT 2001;

-- ---------- products ----------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  image_url text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.products
  FOR ALL USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));
CREATE POLICY "Authenticated read active products" ON public.products
  FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- discount_codes ----------
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'percent', -- percent | fixed
  value numeric NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all', -- all | services | products
  min_subtotal numeric NOT NULL DEFAULT 0,
  max_uses integer,                      -- null = unlimited
  uses_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.discount_codes
  FOR ALL USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));
CREATE TRIGGER trg_discount_codes_updated
  BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- estimates ----------
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number text NOT NULL,
  customer_id uuid,
  customer_property_id uuid,
  job_id uuid,
  assigned_sp_id uuid,
  created_by_user_id uuid,
  status text NOT NULL DEFAULT 'Draft',
  estimate_date date NOT NULL DEFAULT (now()::date),
  expires_at date,
  internal_notes text NOT NULL DEFAULT '',
  customer_notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  share_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  tax_pct numeric NOT NULL DEFAULT 5,
  deposit_kind text NOT NULL DEFAULT 'none', -- none | fixed | percent
  deposit_value numeric NOT NULL DEFAULT 0,
  accepted_package_id uuid,
  accepted_at timestamptz,
  accepted_total numeric,
  accepted_deposit numeric,
  viewed_at timestamptz,
  declined_at timestamptz,
  decline_reason text NOT NULL DEFAULT '',
  converted_job_id uuid,
  converted_at timestamptz,
  snapshot_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimates_customer ON public.estimates(customer_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);
CREATE INDEX idx_estimates_token ON public.estimates(share_token);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.estimates
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));
CREATE POLICY "SP select own estimates" ON public.estimates
  FOR SELECT TO authenticated
  USING (assigned_sp_id IS NOT NULL AND assigned_sp_id = get_user_sp_id(auth.uid()));
CREATE TRIGGER trg_estimates_updated
  BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- estimate_packages ----------
CREATE TABLE public.estimate_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Package',
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_recommended boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT false,
  package_discount_kind text NOT NULL DEFAULT 'none', -- none | percent | fixed
  package_discount_value numeric NOT NULL DEFAULT 0,
  package_discount_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_packages_estimate ON public.estimate_packages(estimate_id);
ALTER TABLE public.estimate_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.estimate_packages
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));
CREATE POLICY "SP select packages of own estimates" ON public.estimate_packages
  FOR SELECT TO authenticated
  USING (estimate_id IN (
    SELECT id FROM public.estimates
    WHERE assigned_sp_id IS NOT NULL AND assigned_sp_id = get_user_sp_id(auth.uid())
  ));
CREATE TRIGGER trg_estimate_packages_updated
  BEFORE UPDATE ON public.estimate_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- estimate_line_items ----------
CREATE TABLE public.estimate_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.estimate_packages(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'service', -- service | product
  catalog_ref_id uuid,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  taxable boolean NOT NULL DEFAULT true,
  is_optional boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT true,
  discount_allowed boolean NOT NULL DEFAULT true,
  image_url text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_line_items_package ON public.estimate_line_items(package_id);
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.estimate_line_items
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));
CREATE POLICY "SP select line items of own estimates" ON public.estimate_line_items
  FOR SELECT TO authenticated
  USING (package_id IN (
    SELECT p.id FROM public.estimate_packages p
    JOIN public.estimates e ON e.id = p.estimate_id
    WHERE e.assigned_sp_id IS NOT NULL AND e.assigned_sp_id = get_user_sp_id(auth.uid())
  ));

-- ---------- estimate_discounts (manual) ----------
CREATE TABLE public.estimate_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.estimate_packages(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'estimate', -- estimate | package
  kind text NOT NULL DEFAULT 'fixed',     -- percent | fixed
  value numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_discounts_estimate ON public.estimate_discounts(estimate_id);
ALTER TABLE public.estimate_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.estimate_discounts
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

-- ---------- estimate_applied_codes ----------
CREATE TABLE public.estimate_applied_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  code_snapshot text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all',
  amount_applied numeric NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_applied_codes_estimate ON public.estimate_applied_codes(estimate_id);
ALTER TABLE public.estimate_applied_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON public.estimate_applied_codes
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

-- ---------- estimate_events ----------
CREATE TABLE public.estimate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  customer_ip text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_estimate_events_estimate ON public.estimate_events(estimate_id);
ALTER TABLE public.estimate_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin read events" ON public.estimate_events
  FOR SELECT TO authenticated USING (is_admin_or_owner(auth.uid()));
CREATE POLICY "Service role insert events" ON public.estimate_events
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner(auth.uid()));

-- =========================================================
-- RPCs
-- =========================================================

-- Create new estimate (with one default package)
CREATE OR REPLACE FUNCTION public.create_estimate(
  _customer_id uuid DEFAULT NULL,
  _customer_property_id uuid DEFAULT NULL,
  _job_id uuid DEFAULT NULL,
  _assigned_sp_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_num integer;
  v_id uuid;
  v_pkg_id uuid;
  v_terms text;
  v_tax numeric;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can create estimates';
  END IF;

  UPDATE public.app_settings SET next_estimate_number = next_estimate_number + 1 WHERE id = 1
    RETURNING next_estimate_number - 1, default_payment_terms, default_tax_pct INTO v_num, v_terms, v_tax;

  INSERT INTO public.estimates (
    estimate_number, customer_id, customer_property_id, job_id,
    assigned_sp_id, created_by_user_id, terms, tax_pct,
    expires_at
  )
  VALUES (
    'EST-' || lpad(v_num::text, 4, '0'),
    _customer_id, _customer_property_id, _job_id,
    _assigned_sp_id, auth.uid(), COALESCE(v_terms,''), COALESCE(v_tax, 5),
    (now() + interval '30 days')::date
  )
  RETURNING id INTO v_id;

  INSERT INTO public.estimate_packages (estimate_id, name, display_order, is_recommended)
  VALUES (v_id, 'Package 1', 0, true)
  RETURNING id INTO v_pkg_id;

  INSERT INTO public.estimate_events (estimate_id, event_type, actor_user_id)
  VALUES (v_id, 'created', auth.uid());

  RETURN jsonb_build_object('id', v_id, 'estimate_number', 'EST-' || lpad(v_num::text, 4, '0'), 'package_id', v_pkg_id);
END;
$$;

-- Public token fetch (auto-flips Sent->Viewed and Sent->Expired)
CREATE OR REPLACE FUNCTION public.get_estimate_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_est FROM public.estimates WHERE share_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Estimate not found');
  END IF;

  -- Auto-expire
  IF v_est.status IN ('Sent', 'Viewed') AND v_est.expires_at IS NOT NULL AND v_est.expires_at < now()::date THEN
    UPDATE public.estimates SET status = 'Expired' WHERE id = v_est.id;
    v_est.status := 'Expired';
  END IF;

  -- Mark first view
  IF v_est.status = 'Sent' THEN
    UPDATE public.estimates SET status = 'Viewed', viewed_at = COALESCE(viewed_at, now()) WHERE id = v_est.id;
    v_est.status := 'Viewed';
    INSERT INTO public.estimate_events (estimate_id, event_type) VALUES (v_est.id, 'viewed');
  END IF;

  SELECT jsonb_build_object(
    'estimate', row_to_json(v_est),
    'customer', (SELECT row_to_json(c) FROM public.customers c WHERE c.id = v_est.customer_id),
    'company', (SELECT row_to_json(s) FROM public.app_settings s WHERE s.id = 1),
    'packages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'package', row_to_json(p),
        'items', COALESCE((
          SELECT jsonb_agg(row_to_json(li) ORDER BY li.display_order)
          FROM public.estimate_line_items li WHERE li.package_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.display_order)
      FROM public.estimate_packages p WHERE p.estimate_id = v_est.id
    ), '[]'::jsonb),
    'manual_discounts', COALESCE((
      SELECT jsonb_agg(row_to_json(d)) FROM public.estimate_discounts d WHERE d.estimate_id = v_est.id
    ), '[]'::jsonb),
    'applied_codes', COALESCE((
      SELECT jsonb_agg(row_to_json(a)) FROM public.estimate_applied_codes a WHERE a.estimate_id = v_est.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_estimate_by_token(text) TO anon, authenticated;

-- Customer accept (token-based, anon)
CREATE OR REPLACE FUNCTION public.customer_accept_estimate(
  _token text,
  _package_id uuid,
  _selected_item_ids uuid[],
  _accepted_total numeric,
  _accepted_deposit numeric DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
  v_pkg public.estimate_packages%ROWTYPE;
BEGIN
  SELECT * INTO v_est FROM public.estimates WHERE share_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Estimate not found');
  END IF;
  IF v_est.status NOT IN ('Sent', 'Viewed') THEN
    RETURN jsonb_build_object('error', 'Estimate cannot be accepted in status ' || v_est.status);
  END IF;

  SELECT * INTO v_pkg FROM public.estimate_packages WHERE id = _package_id AND estimate_id = v_est.id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Package does not belong to this estimate');
  END IF;

  -- Update line item selection within the chosen package
  UPDATE public.estimate_line_items
    SET is_selected = (id = ANY(_selected_item_ids) OR is_optional = false)
    WHERE package_id = _package_id;

  -- Mark winning package
  UPDATE public.estimate_packages SET is_selected = (id = _package_id) WHERE estimate_id = v_est.id;

  -- Snapshot
  UPDATE public.estimates SET
    status = 'Accepted',
    accepted_package_id = _package_id,
    accepted_at = now(),
    accepted_total = _accepted_total,
    accepted_deposit = _accepted_deposit,
    snapshot_json = (SELECT public.get_estimate_by_token(_token))
  WHERE id = v_est.id;

  INSERT INTO public.estimate_events (estimate_id, event_type, details)
  VALUES (v_est.id, 'accepted', jsonb_build_object('package_id', _package_id, 'total', _accepted_total));

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_accept_estimate(text, uuid, uuid[], numeric, numeric) TO anon, authenticated;

-- Customer decline (token-based, anon)
CREATE OR REPLACE FUNCTION public.customer_decline_estimate(_token text, _reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
BEGIN
  SELECT * INTO v_est FROM public.estimates WHERE share_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Estimate not found'); END IF;
  IF v_est.status NOT IN ('Sent', 'Viewed') THEN
    RETURN jsonb_build_object('error', 'Estimate cannot be declined in status ' || v_est.status);
  END IF;

  UPDATE public.estimates SET
    status = 'Declined',
    declined_at = now(),
    decline_reason = COALESCE(_reason, '')
  WHERE id = v_est.id;

  INSERT INTO public.estimate_events (estimate_id, event_type, details)
  VALUES (v_est.id, 'declined', jsonb_build_object('reason', _reason));

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.customer_decline_estimate(text, text) TO anon, authenticated;

-- Apply discount code (admin)
CREATE OR REPLACE FUNCTION public.apply_discount_code(_estimate_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dc public.discount_codes%ROWTYPE;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_dc FROM public.discount_codes WHERE upper(code) = upper(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Code not found'); END IF;
  IF NOT v_dc.active THEN RETURN jsonb_build_object('error', 'Code is inactive'); END IF;
  IF v_dc.expires_at IS NOT NULL AND v_dc.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Code has expired');
  END IF;
  IF v_dc.max_uses IS NOT NULL AND v_dc.uses_count >= v_dc.max_uses THEN
    RETURN jsonb_build_object('error', 'Code usage limit reached');
  END IF;

  -- Prevent duplicate
  IF EXISTS (SELECT 1 FROM public.estimate_applied_codes WHERE estimate_id = _estimate_id AND discount_code_id = v_dc.id) THEN
    RETURN jsonb_build_object('error', 'Code already applied');
  END IF;

  INSERT INTO public.estimate_applied_codes (estimate_id, discount_code_id, code_snapshot, kind, value, applies_to)
  VALUES (_estimate_id, v_dc.id, v_dc.code, v_dc.kind, v_dc.value, v_dc.applies_to);

  UPDATE public.discount_codes SET uses_count = uses_count + 1 WHERE id = v_dc.id;

  RETURN jsonb_build_object('success', true, 'code', v_dc.code);
END;
$$;

-- Duplicate package
CREATE OR REPLACE FUNCTION public.duplicate_estimate_package(_package_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_id uuid;
  v_src public.estimate_packages%ROWTYPE;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_src FROM public.estimate_packages WHERE id = _package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  INSERT INTO public.estimate_packages (
    estimate_id, name, description, display_order, is_recommended,
    package_discount_kind, package_discount_value, package_discount_reason
  ) VALUES (
    v_src.estimate_id, v_src.name || ' (copy)', v_src.description,
    (SELECT COALESCE(MAX(display_order),0)+1 FROM public.estimate_packages WHERE estimate_id = v_src.estimate_id),
    false, v_src.package_discount_kind, v_src.package_discount_value, v_src.package_discount_reason
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.estimate_line_items
    (package_id, item_type, catalog_ref_id, name, description, quantity, unit_price,
     taxable, is_optional, is_selected, discount_allowed, image_url, display_order)
  SELECT v_new_id, item_type, catalog_ref_id, name, description, quantity, unit_price,
         taxable, is_optional, is_selected, discount_allowed, image_url, display_order
  FROM public.estimate_line_items WHERE package_id = _package_id;

  RETURN v_new_id;
END;
$$;

-- Duplicate full estimate
CREATE OR REPLACE FUNCTION public.duplicate_estimate(_estimate_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_id uuid;
  v_num integer;
  v_src public.estimates%ROWTYPE;
  v_pkg record;
  v_new_pkg uuid;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v_src FROM public.estimates WHERE id = _estimate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estimate not found'; END IF;

  UPDATE public.app_settings SET next_estimate_number = next_estimate_number + 1 WHERE id = 1
    RETURNING next_estimate_number - 1 INTO v_num;

  INSERT INTO public.estimates (
    estimate_number, customer_id, customer_property_id, job_id,
    assigned_sp_id, created_by_user_id, terms, tax_pct, expires_at,
    customer_notes, internal_notes, deposit_kind, deposit_value
  ) VALUES (
    'EST-' || lpad(v_num::text, 4, '0'),
    v_src.customer_id, v_src.customer_property_id, NULL,
    v_src.assigned_sp_id, auth.uid(), v_src.terms, v_src.tax_pct,
    (now() + interval '30 days')::date,
    v_src.customer_notes, v_src.internal_notes, v_src.deposit_kind, v_src.deposit_value
  ) RETURNING id INTO v_new_id;

  FOR v_pkg IN SELECT * FROM public.estimate_packages WHERE estimate_id = _estimate_id ORDER BY display_order LOOP
    INSERT INTO public.estimate_packages
      (estimate_id, name, description, display_order, is_recommended,
       package_discount_kind, package_discount_value, package_discount_reason)
    VALUES (v_new_id, v_pkg.name, v_pkg.description, v_pkg.display_order, v_pkg.is_recommended,
            v_pkg.package_discount_kind, v_pkg.package_discount_value, v_pkg.package_discount_reason)
    RETURNING id INTO v_new_pkg;

    INSERT INTO public.estimate_line_items
      (package_id, item_type, catalog_ref_id, name, description, quantity, unit_price,
       taxable, is_optional, is_selected, discount_allowed, image_url, display_order)
    SELECT v_new_pkg, item_type, catalog_ref_id, name, description, quantity, unit_price,
           taxable, is_optional, is_selected, discount_allowed, image_url, display_order
    FROM public.estimate_line_items WHERE package_id = v_pkg.id;
  END LOOP;

  RETURN v_new_id;
END;
$$;

-- Convert accepted estimate to job
CREATE OR REPLACE FUNCTION public.convert_estimate_to_job(
  _estimate_id uuid,
  _mode text,            -- 'new' | 'attach'
  _existing_job_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_job_id uuid;
  v_job_num text;
  v_jnum integer;
  v_item record;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_est FROM public.estimates WHERE id = _estimate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estimate not found'; END IF;
  IF v_est.status <> 'Accepted' THEN
    RETURN jsonb_build_object('error', 'Estimate must be Accepted before converting');
  END IF;
  IF v_est.accepted_package_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No accepted package');
  END IF;

  IF _mode = 'new' THEN
    SELECT * INTO v_cust FROM public.customers WHERE id = v_est.customer_id;
    -- Generate job number using existing pattern (count-based fallback)
    SELECT COALESCE(MAX(NULLIF(regexp_replace(job_number, '\D', '', 'g'), '')::int), 1000) + 1
      INTO v_jnum FROM public.jobs;
    v_job_num := 'JOB-' || lpad(v_jnum::text, 4, '0');

    INSERT INTO public.jobs (
      job_number, customer_id, customer_property_id, assigned_sp_id,
      service_category, status, urgency, notes,
      job_address_street, job_address_city, job_address_region,
      job_address_postal, job_address_country, job_lat, job_lng
    ) VALUES (
      v_job_num, v_est.customer_id, v_est.customer_property_id, v_est.assigned_sp_id,
      '', 'Created', 'Scheduled',
      COALESCE(v_est.customer_notes, ''),
      COALESCE(v_cust.address_street, ''), COALESCE(v_cust.address_city, ''),
      COALESCE(v_cust.address_region, ''), COALESCE(v_cust.address_postal, ''),
      COALESCE(v_cust.address_country, 'Canada'), v_cust.address_lat, v_cust.address_lng
    ) RETURNING id INTO v_job_id;
  ELSIF _mode = 'attach' THEN
    IF _existing_job_id IS NULL THEN
      RETURN jsonb_build_object('error', 'job_id required for attach mode');
    END IF;
    v_job_id := _existing_job_id;
    DELETE FROM public.job_services WHERE job_id = v_job_id;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid mode');
  END IF;

  -- Copy selected items into job_services
  FOR v_item IN
    SELECT * FROM public.estimate_line_items
    WHERE package_id = v_est.accepted_package_id AND is_selected = true
    ORDER BY display_order
  LOOP
    INSERT INTO public.job_services (job_id, service_category, quantity, unit_price, line_total, notes)
    VALUES (v_job_id, COALESCE(NULLIF(v_item.name,''), v_item.item_type),
            v_item.quantity, v_item.unit_price,
            v_item.quantity * v_item.unit_price,
            v_item.description);
  END LOOP;

  UPDATE public.estimates SET
    status = 'Converted',
    converted_job_id = v_job_id,
    converted_at = now()
  WHERE id = _estimate_id;

  INSERT INTO public.estimate_events (estimate_id, event_type, actor_user_id, details)
  VALUES (_estimate_id, 'converted', auth.uid(), jsonb_build_object('mode', _mode, 'job_id', v_job_id));

  RETURN jsonb_build_object('success', true, 'job_id', v_job_id);
END;
$$;

-- Mark sent (admin path bypassing email)
CREATE OR REPLACE FUNCTION public.mark_estimate_sent(_estimate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.estimates SET status = 'Sent' WHERE id = _estimate_id AND status = 'Draft';
  INSERT INTO public.estimate_events (estimate_id, event_type, actor_user_id)
  VALUES (_estimate_id, 'sent', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;