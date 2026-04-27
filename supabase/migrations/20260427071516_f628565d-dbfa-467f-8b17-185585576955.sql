-- =========================================================
-- INVOICES MODULE: REBUILD TO MIRROR ESTIMATES
-- =========================================================

-- ---------- 1. app_settings: payment instructions ----------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS payment_instructions text NOT NULL DEFAULT '';

-- ---------- 2. extend customer_invoices ----------
ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS invoice_date date NOT NULL DEFAULT (now()::date),
  ADD COLUMN IF NOT EXISTS service_address_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_address_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_address_region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_address_postal text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_address_country text NOT NULL DEFAULT 'Canada',
  ADD COLUMN IF NOT EXISTS billing_address_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address_region text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address_postal text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address_country text NOT NULL DEFAULT 'Canada',
  ADD COLUMN IF NOT EXISTS billing_same_as_service boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assigned_sp_id uuid,
  ADD COLUMN IF NOT EXISTS source_estimate_id uuid,
  ADD COLUMN IF NOT EXISTS source_estimate_package_id uuid,
  ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_package_id uuid,
  ADD COLUMN IF NOT EXISTS services_subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS products_subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS customer_facing_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_assigned_sp ON public.customer_invoices(assigned_sp_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_source_estimate ON public.customer_invoices(source_estimate_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_due_date ON public.customer_invoices(due_date);

-- Replace the validation trigger to allow the new statuses
CREATE OR REPLACE FUNCTION public.tg_validate_customer_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN (
    'Draft','Sent','Viewed','Partially Paid','Paid','Overdue','Void','Archived','Cancelled'
  ) THEN
    RAISE EXCEPTION 'Invalid invoice status: %', NEW.status;
  END IF;
  IF NEW.subtotal < 0 OR NEW.tax_pct < 0 OR NEW.tax_amount < 0 OR NEW.total < 0
     OR NEW.amount_paid < 0 OR NEW.balance_due < 0 OR NEW.deposit_applied < 0 THEN
    RAISE EXCEPTION 'Invoice amounts must be non-negative';
  END IF;
  RETURN NEW;
END;
$$;

-- SP read-only access on invoices assigned to them
DROP POLICY IF EXISTS "SP select own invoices" ON public.customer_invoices;
CREATE POLICY "SP select own invoices"
  ON public.customer_invoices FOR SELECT
  TO authenticated
  USING (assigned_sp_id IS NOT NULL AND assigned_sp_id = get_user_sp_id(auth.uid()));

-- ---------- 3. invoice_packages ----------
CREATE TABLE IF NOT EXISTS public.invoice_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Full invoice',
  description text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_recommended boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT false,
  package_discount_kind text NOT NULL DEFAULT 'none',
  package_discount_value numeric NOT NULL DEFAULT 0,
  package_discount_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_packages_invoice ON public.invoice_packages(invoice_id);
ALTER TABLE public.invoice_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.invoice_packages;
CREATE POLICY "Admin full access" ON public.invoice_packages
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select packages of own invoices" ON public.invoice_packages;
CREATE POLICY "SP select packages of own invoices" ON public.invoice_packages
  FOR SELECT TO authenticated
  USING (invoice_id IN (
    SELECT id FROM public.customer_invoices
    WHERE assigned_sp_id IS NOT NULL AND assigned_sp_id = get_user_sp_id(auth.uid())
  ));

DROP TRIGGER IF EXISTS trg_invoice_packages_updated ON public.invoice_packages;
CREATE TRIGGER trg_invoice_packages_updated
  BEFORE UPDATE ON public.invoice_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 4. invoice_line_items ----------
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.invoice_packages(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'service',
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
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_package ON public.invoice_line_items(package_id);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.invoice_line_items;
CREATE POLICY "Admin full access" ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select line items of own invoices" ON public.invoice_line_items;
CREATE POLICY "SP select line items of own invoices" ON public.invoice_line_items
  FOR SELECT TO authenticated
  USING (package_id IN (
    SELECT p.id FROM public.invoice_packages p
    JOIN public.customer_invoices i ON i.id = p.invoice_id
    WHERE i.assigned_sp_id IS NOT NULL AND i.assigned_sp_id = get_user_sp_id(auth.uid())
  ));

-- ---------- 5. invoice_discounts (manual) ----------
CREATE TABLE IF NOT EXISTS public.invoice_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.invoice_packages(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES public.invoice_line_items(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'invoice', -- invoice | package | line
  kind text NOT NULL DEFAULT 'fixed',    -- percent | fixed
  value numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_discounts_invoice ON public.invoice_discounts(invoice_id);
ALTER TABLE public.invoice_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.invoice_discounts;
CREATE POLICY "Admin full access" ON public.invoice_discounts
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

-- ---------- 6. invoice_applied_codes ----------
CREATE TABLE IF NOT EXISTS public.invoice_applied_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  code_snapshot text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'percent',
  value numeric NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all',
  amount_applied numeric NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_applied_codes_invoice ON public.invoice_applied_codes(invoice_id);
ALTER TABLE public.invoice_applied_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.invoice_applied_codes;
CREATE POLICY "Admin full access" ON public.invoice_applied_codes
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

-- ---------- 7. invoice_payments ----------
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT (now()::date),
  method text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  recorded_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.invoice_payments;
CREATE POLICY "Admin full access" ON public.invoice_payments
  FOR ALL TO authenticated
  USING (is_admin_or_owner(auth.uid())) WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select payments of own invoices" ON public.invoice_payments;
CREATE POLICY "SP select payments of own invoices" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (invoice_id IN (
    SELECT id FROM public.customer_invoices
    WHERE assigned_sp_id IS NOT NULL AND assigned_sp_id = get_user_sp_id(auth.uid())
  ));

-- ---------- 8. invoice_events ----------
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid,
  customer_ip text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON public.invoice_events(invoice_id);
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read events" ON public.invoice_events;
CREATE POLICY "Admin read events" ON public.invoice_events
  FOR SELECT TO authenticated USING (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin insert events" ON public.invoice_events;
CREATE POLICY "Admin insert events" ON public.invoice_events
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_owner(auth.uid()));

-- =========================================================
-- RPCs
-- =========================================================

-- create_invoice: blank invoice + one default package
CREATE OR REPLACE FUNCTION public.create_invoice(
  _customer_id uuid DEFAULT NULL,
  _job_id uuid DEFAULT NULL,
  _assigned_sp_id uuid DEFAULT NULL,
  _parent_invoice_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_pkg uuid;
  v_no text;
  v_settings record;
  v_cust record;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can create invoices';
  END IF;

  v_no := public.next_customer_invoice_number();
  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;

  IF _customer_id IS NOT NULL THEN
    SELECT * INTO v_cust FROM public.customers WHERE id = _customer_id;
  END IF;

  INSERT INTO public.customer_invoices (
    invoice_number, customer_id, job_id, assigned_sp_id, parent_invoice_id,
    status, tax_pct, payment_terms, terms, payment_terms_days, due_date,
    invoice_date, created_by_user_id,
    service_address_street, service_address_city, service_address_region,
    service_address_postal, service_address_country,
    billing_same_as_service
  ) VALUES (
    v_no, _customer_id, _job_id, _assigned_sp_id, _parent_invoice_id,
    'Draft', COALESCE(v_settings.default_tax_pct, 5),
    COALESCE(v_settings.default_payment_terms, ''),
    COALESCE(v_settings.default_payment_terms, ''), 15,
    (now() + interval '15 days')::date,
    (now())::date, auth.uid(),
    COALESCE(v_cust.address_street, ''), COALESCE(v_cust.address_city, ''),
    COALESCE(v_cust.address_region, ''), COALESCE(v_cust.address_postal, ''),
    COALESCE(v_cust.address_country, 'Canada'),
    true
  ) RETURNING id INTO v_id;

  INSERT INTO public.invoice_packages (invoice_id, name, display_order, is_selected, is_recommended)
  VALUES (v_id, 'Full invoice', 0, true, true)
  RETURNING id INTO v_pkg;

  UPDATE public.customer_invoices SET selected_package_id = v_pkg WHERE id = v_id;

  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id)
  VALUES (v_id, 'created', auth.uid());

  RETURN jsonb_build_object('id', v_id, 'invoice_number', v_no, 'package_id', v_pkg);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, uuid, uuid) TO authenticated;

-- duplicate_invoice_package
CREATE OR REPLACE FUNCTION public.duplicate_invoice_package(_package_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new uuid;
  v_src public.invoice_packages%ROWTYPE;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v_src FROM public.invoice_packages WHERE id = _package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Package not found'; END IF;

  INSERT INTO public.invoice_packages (
    invoice_id, name, description, display_order, is_recommended,
    package_discount_kind, package_discount_value, package_discount_reason
  ) VALUES (
    v_src.invoice_id, v_src.name || ' (copy)', v_src.description,
    (SELECT COALESCE(MAX(display_order),0)+1 FROM public.invoice_packages WHERE invoice_id = v_src.invoice_id),
    false, v_src.package_discount_kind, v_src.package_discount_value, v_src.package_discount_reason
  ) RETURNING id INTO v_new;

  INSERT INTO public.invoice_line_items
    (package_id, item_type, catalog_ref_id, name, description, quantity, unit_price,
     taxable, is_optional, is_selected, discount_allowed, image_url, display_order)
  SELECT v_new, item_type, catalog_ref_id, name, description, quantity, unit_price,
         taxable, is_optional, is_selected, discount_allowed, image_url, display_order
  FROM public.invoice_line_items WHERE package_id = _package_id;

  RETURN v_new;
END;
$$;
GRANT EXECUTE ON FUNCTION public.duplicate_invoice_package(uuid) TO authenticated;

-- apply_invoice_discount_code
CREATE OR REPLACE FUNCTION public.apply_invoice_discount_code(_invoice_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dc public.discount_codes%ROWTYPE;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_dc FROM public.discount_codes WHERE upper(code) = upper(_code);
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Code not found'); END IF;
  IF NOT v_dc.active THEN RETURN jsonb_build_object('error','Code is inactive'); END IF;
  IF v_dc.expires_at IS NOT NULL AND v_dc.expires_at < now() THEN
    RETURN jsonb_build_object('error','Code has expired');
  END IF;
  IF v_dc.max_uses IS NOT NULL AND v_dc.uses_count >= v_dc.max_uses THEN
    RETURN jsonb_build_object('error','Code usage limit reached');
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoice_applied_codes WHERE invoice_id = _invoice_id AND discount_code_id = v_dc.id) THEN
    RETURN jsonb_build_object('error','Code already applied');
  END IF;

  INSERT INTO public.invoice_applied_codes (invoice_id, discount_code_id, code_snapshot, kind, value, applies_to)
  VALUES (_invoice_id, v_dc.id, v_dc.code, v_dc.kind, v_dc.value, v_dc.applies_to);

  UPDATE public.discount_codes SET uses_count = uses_count + 1 WHERE id = v_dc.id;

  RETURN jsonb_build_object('success', true, 'code', v_dc.code);
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_invoice_discount_code(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_invoice_applied_code(_applied_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  DELETE FROM public.invoice_applied_codes WHERE id = _applied_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_invoice_applied_code(uuid) TO authenticated;

-- record_invoice_payment
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  _invoice_id uuid,
  _amount numeric,
  _method text DEFAULT '',
  _reference text DEFAULT '',
  _notes text DEFAULT '',
  _payment_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.customer_invoices%ROWTYPE;
  v_paid numeric;
  v_balance numeric;
  v_status text;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _amount <= 0 THEN RETURN jsonb_build_object('error','Amount must be positive'); END IF;

  SELECT * INTO v_inv FROM public.customer_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invoice not found'); END IF;
  IF v_inv.status IN ('Void','Archived','Cancelled') THEN
    RETURN jsonb_build_object('error','Cannot record payment on ' || v_inv.status || ' invoice');
  END IF;

  INSERT INTO public.invoice_payments (invoice_id, amount, payment_date, method, reference, notes, recorded_by_user_id)
  VALUES (_invoice_id, _amount, COALESCE(_payment_date, now()::date), _method, _reference, _notes, auth.uid());

  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.invoice_payments WHERE invoice_id = _invoice_id;
  v_balance := GREATEST(0, COALESCE(v_inv.total,0) - COALESCE(v_inv.deposit_applied,0) - v_paid);

  IF v_balance <= 0 THEN
    v_status := 'Paid';
  ELSIF v_paid > 0 THEN
    v_status := 'Partially Paid';
  ELSE
    v_status := v_inv.status;
  END IF;

  UPDATE public.customer_invoices
  SET amount_paid = v_paid,
      balance_due = v_balance,
      status = v_status,
      paid_at = CASE WHEN v_status = 'Paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      payment_method = CASE WHEN v_status = 'Paid' AND payment_method = '' THEN _method ELSE payment_method END,
      payment_reference = CASE WHEN v_status = 'Paid' AND payment_reference = '' THEN _reference ELSE payment_reference END
  WHERE id = _invoice_id;

  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id, details)
  VALUES (_invoice_id, 'payment_recorded', auth.uid(),
          jsonb_build_object('amount', _amount, 'method', _method, 'balance_due', v_balance));

  RETURN jsonb_build_object('success', true, 'balance_due', v_balance, 'status', v_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, numeric, text, text, text, date) TO authenticated;

-- void / archive
CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.customer_invoices SET status='Void', voided_at = now() WHERE id = _invoice_id;
  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id, details)
  VALUES (_invoice_id, 'voided', auth.uid(), jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.void_invoice(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.customer_invoices SET status='Archived', archived_at = now() WHERE id = _invoice_id;
  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id)
  VALUES (_invoice_id, 'archived', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_invoice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unarchive_invoice(_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.customer_invoices%ROWTYPE;
  v_new text;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO v_inv FROM public.customer_invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invoice not found'); END IF;

  IF v_inv.balance_due <= 0 AND v_inv.amount_paid > 0 THEN v_new := 'Paid';
  ELSIF v_inv.amount_paid > 0 THEN v_new := 'Partially Paid';
  ELSIF v_inv.sent_at IS NOT NULL THEN v_new := 'Sent';
  ELSE v_new := 'Draft';
  END IF;

  UPDATE public.customer_invoices SET status = v_new, archived_at = NULL WHERE id = _invoice_id;
  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id)
  VALUES (_invoice_id, 'unarchived', auth.uid());
  RETURN jsonb_build_object('success', true, 'status', v_new);
END;
$$;
GRANT EXECUTE ON FUNCTION public.unarchive_invoice(uuid) TO authenticated;

-- mark_invoice_viewed_by_token (anon)
CREATE OR REPLACE FUNCTION public.mark_invoice_viewed_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.customer_invoices%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.customer_invoices WHERE share_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invoice not found'); END IF;
  IF v_inv.status = 'Sent' THEN
    UPDATE public.customer_invoices SET status='Viewed', viewed_at = COALESCE(viewed_at, now()) WHERE id = v_inv.id;
    INSERT INTO public.invoice_events (invoice_id, event_type) VALUES (v_inv.id, 'viewed');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_invoice_viewed_by_token(text) TO anon, authenticated;

-- Replace mark_customer_invoice_sent: snapshot + due date
CREATE OR REPLACE FUNCTION public.mark_customer_invoice_sent(_invoice_id uuid, _pdf_path text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.customer_invoices%ROWTYPE;
  _snapshot jsonb;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT * INTO _inv FROM public.customer_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invoice not found'); END IF;

  -- Build snapshot
  SELECT jsonb_build_object(
    'invoice', to_jsonb(_inv),
    'packages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'package', to_jsonb(p),
        'items', COALESCE((
          SELECT jsonb_agg(to_jsonb(li) ORDER BY li.display_order)
          FROM public.invoice_line_items li WHERE li.package_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.display_order)
      FROM public.invoice_packages p WHERE p.invoice_id = _inv.id
    ), '[]'::jsonb),
    'manual_discounts', COALESCE((
      SELECT jsonb_agg(to_jsonb(d)) FROM public.invoice_discounts d WHERE d.invoice_id = _inv.id
    ), '[]'::jsonb),
    'applied_codes', COALESCE((
      SELECT jsonb_agg(to_jsonb(a)) FROM public.invoice_applied_codes a WHERE a.invoice_id = _inv.id
    ), '[]'::jsonb)
  ) INTO _snapshot;

  UPDATE public.customer_invoices
  SET status = 'Sent',
      sent_at = COALESCE(sent_at, now()),
      sent_by_user_id = COALESCE(sent_by_user_id, auth.uid()),
      due_date = COALESCE(due_date, (now() + COALESCE(payment_terms_days,15) * interval '1 day')::date),
      pdf_storage_path = CASE WHEN _pdf_path = '' THEN pdf_storage_path ELSE _pdf_path END,
      snapshot_json = _snapshot
  WHERE id = _invoice_id;

  IF _inv.job_id IS NOT NULL THEN
    UPDATE public.jobs SET status = 'InvoiceSent' WHERE id = _inv.job_id AND status IN ('Completed','ConvertedToInvoice');
  END IF;

  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id)
  VALUES (_invoice_id, 'sent', auth.uid());

  RETURN jsonb_build_object('success', true, 'share_token', _inv.share_token);
END;
$$;

-- Replace get_customer_invoice_by_token to include full data
CREATE OR REPLACE FUNCTION public.get_customer_invoice_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.customer_invoices%ROWTYPE;
  _customer record;
  _settings record;
  _packages jsonb;
  _legacy_items jsonb;
  _payments jsonb;
  _discounts jsonb;
  _codes jsonb;
BEGIN
  SELECT * INTO _inv FROM public.customer_invoices WHERE share_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invoice not found'); END IF;
  IF _inv.status = 'Draft' THEN RETURN jsonb_build_object('error','Invoice not yet sent'); END IF;
  IF _inv.status = 'Void' THEN RETURN jsonb_build_object('error','This invoice has been voided'); END IF;

  SELECT * INTO _customer FROM public.customers WHERE id = _inv.customer_id;
  SELECT * INTO _settings FROM public.app_settings WHERE id = 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'package', to_jsonb(p),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(li) ORDER BY li.display_order)
      FROM public.invoice_line_items li WHERE li.package_id = p.id
    ), '[]'::jsonb)
  ) ORDER BY p.display_order), '[]'::jsonb)
  INTO _packages
  FROM public.invoice_packages p WHERE p.invoice_id = _inv.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'description', description, 'quantity', quantity,
    'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY display_order, created_at), '[]'::jsonb)
  INTO _legacy_items
  FROM public.customer_invoice_line_items WHERE invoice_id = _inv.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(pmt) ORDER BY pmt.payment_date), '[]'::jsonb)
  INTO _payments
  FROM public.invoice_payments pmt WHERE pmt.invoice_id = _inv.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
  INTO _discounts
  FROM public.invoice_discounts d WHERE d.invoice_id = _inv.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  INTO _codes
  FROM public.invoice_applied_codes a WHERE a.invoice_id = _inv.id;

  RETURN jsonb_build_object(
    'invoice', to_jsonb(_inv),
    'customer', to_jsonb(_customer),
    'company', to_jsonb(_settings),
    'packages', _packages,
    'legacy_line_items', _legacy_items,
    'payments', _payments,
    'manual_discounts', _discounts,
    'applied_codes', _codes,
    'payment_instructions', COALESCE(_settings.payment_instructions, '')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_customer_invoice_by_token(text) TO anon, authenticated;

-- convert_estimate_to_invoice
CREATE OR REPLACE FUNCTION public.convert_estimate_to_invoice(_estimate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
  v_inv_id uuid;
  v_inv_no text;
  v_pkg_id uuid;
  v_settings record;
  v_cust record;
  v_item record;
  v_existing uuid;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO v_est FROM public.estimates WHERE id = _estimate_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Estimate not found'); END IF;
  IF v_est.status NOT IN ('Accepted','Converted') THEN
    RETURN jsonb_build_object('error','Estimate must be Accepted before invoicing');
  END IF;
  IF v_est.accepted_package_id IS NULL THEN
    RETURN jsonb_build_object('error','No accepted package on estimate');
  END IF;

  -- Reuse a draft if already created from this estimate
  SELECT id INTO v_existing FROM public.customer_invoices
   WHERE source_estimate_id = _estimate_id AND status = 'Draft' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invoice_id', v_existing, 'reused', true);
  END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;
  SELECT * INTO v_cust FROM public.customers WHERE id = v_est.customer_id;
  v_inv_no := public.next_customer_invoice_number();

  INSERT INTO public.customer_invoices (
    invoice_number, customer_id, job_id, assigned_sp_id,
    source_estimate_id, source_estimate_package_id,
    status, tax_pct, payment_terms, terms, payment_terms_days, due_date,
    invoice_date, customer_facing_notes, internal_notes,
    deposit_applied, created_by_user_id,
    service_address_street, service_address_city, service_address_region,
    service_address_postal, service_address_country, billing_same_as_service
  ) VALUES (
    v_inv_no, v_est.customer_id, v_est.job_id, v_est.assigned_sp_id,
    _estimate_id, v_est.accepted_package_id,
    'Draft', COALESCE(v_est.tax_pct, 5),
    COALESCE(v_settings.default_payment_terms,''), COALESCE(v_est.terms,''),
    15, (now() + interval '15 days')::date,
    (now())::date, COALESCE(v_est.customer_notes,''), COALESCE(v_est.internal_notes,''),
    COALESCE(v_est.accepted_deposit, 0), auth.uid(),
    COALESCE(v_cust.address_street, ''), COALESCE(v_cust.address_city, ''),
    COALESCE(v_cust.address_region, ''), COALESCE(v_cust.address_postal, ''),
    COALESCE(v_cust.address_country, 'Canada'), true
  ) RETURNING id INTO v_inv_id;

  -- Create one package mirroring the accepted estimate package
  INSERT INTO public.invoice_packages (
    invoice_id, name, description, display_order, is_recommended, is_selected,
    package_discount_kind, package_discount_value, package_discount_reason
  )
  SELECT v_inv_id, name, description, 0, true, true,
         package_discount_kind, package_discount_value, package_discount_reason
  FROM public.estimate_packages WHERE id = v_est.accepted_package_id
  RETURNING id INTO v_pkg_id;

  UPDATE public.customer_invoices SET selected_package_id = v_pkg_id WHERE id = v_inv_id;

  -- Copy ONLY selected line items
  FOR v_item IN
    SELECT * FROM public.estimate_line_items
    WHERE package_id = v_est.accepted_package_id AND is_selected = true
    ORDER BY display_order
  LOOP
    INSERT INTO public.invoice_line_items (
      package_id, item_type, catalog_ref_id, name, description,
      quantity, unit_price, taxable, is_optional, is_selected, discount_allowed,
      image_url, display_order
    ) VALUES (
      v_pkg_id, v_item.item_type, v_item.catalog_ref_id, v_item.name, v_item.description,
      v_item.quantity, v_item.unit_price, v_item.taxable, false, true, v_item.discount_allowed,
      v_item.image_url, v_item.display_order
    );
  END LOOP;

  -- Copy estimate-wide manual discounts
  INSERT INTO public.invoice_discounts (invoice_id, scope, kind, value, reason)
  SELECT v_inv_id, 'invoice', kind, value, reason
  FROM public.estimate_discounts
  WHERE estimate_id = _estimate_id AND scope = 'estimate';

  -- Copy applied codes
  INSERT INTO public.invoice_applied_codes (invoice_id, discount_code_id, code_snapshot, kind, value, applies_to, amount_applied)
  SELECT v_inv_id, discount_code_id, code_snapshot, kind, value, applies_to, amount_applied
  FROM public.estimate_applied_codes WHERE estimate_id = _estimate_id;

  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id, details)
  VALUES (v_inv_id, 'created_from_estimate', auth.uid(),
          jsonb_build_object('estimate_id', _estimate_id, 'estimate_number', v_est.estimate_number));

  RETURN jsonb_build_object('success', true, 'invoice_id', v_inv_id, 'invoice_number', v_inv_no);
END;
$$;
GRANT EXECUTE ON FUNCTION public.convert_estimate_to_invoice(uuid) TO authenticated;

-- Replace convert_job_to_invoice to use the new packages model.
-- Prefer routing through the source estimate when present.
CREATE OR REPLACE FUNCTION public.convert_job_to_invoice(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _job RECORD;
  _settings record;
  _invoice_id uuid;
  _invoice_no text;
  _pkg_id uuid;
  _service RECORD;
  _has_services boolean := false;
  _existing uuid;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;

  SELECT * INTO _job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Job not found'); END IF;
  IF _job.status NOT IN ('Completed','ConvertedToInvoice','InvoiceSent') THEN
    RETURN jsonb_build_object('error','Only completed jobs can be converted to invoice');
  END IF;

  -- Reuse existing draft
  SELECT id INTO _existing FROM public.customer_invoices
   WHERE job_id = _job_id AND status = 'Draft' LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invoice_id', _existing, 'reused', true);
  END IF;

  -- If job came from an accepted estimate, prefer that path
  IF _job.source_estimate_id IS NOT NULL THEN
    RETURN public.convert_estimate_to_invoice(_job.source_estimate_id);
  END IF;

  SELECT * INTO _settings FROM public.app_settings WHERE id = 1;
  _invoice_no := public.next_customer_invoice_number();

  INSERT INTO public.customer_invoices (
    invoice_number, job_id, customer_id, assigned_sp_id, status,
    tax_pct, payment_terms, terms, payment_terms_days, due_date,
    invoice_date, deposit_applied, created_by_user_id,
    service_address_street, service_address_city, service_address_region,
    service_address_postal, service_address_country, billing_same_as_service
  ) VALUES (
    _invoice_no, _job.id, _job.customer_id, _job.assigned_sp_id, 'Draft',
    COALESCE(_settings.default_tax_pct, 5),
    COALESCE(_settings.default_payment_terms, ''), '',
    15, (now() + interval '15 days')::date,
    (now())::date, COALESCE(_job.deposit_received, 0), auth.uid(),
    COALESCE(_job.job_address_street,''), COALESCE(_job.job_address_city,''),
    COALESCE(_job.job_address_region,''), COALESCE(_job.job_address_postal,''),
    COALESCE(_job.job_address_country,'Canada'), true
  ) RETURNING id INTO _invoice_id;

  INSERT INTO public.invoice_packages (invoice_id, name, display_order, is_selected, is_recommended)
  VALUES (_invoice_id, 'Full invoice', 0, true, true)
  RETURNING id INTO _pkg_id;

  UPDATE public.customer_invoices SET selected_package_id = _pkg_id WHERE id = _invoice_id;

  FOR _service IN
    SELECT service_category, quantity, unit_price, line_total, notes
    FROM public.job_services WHERE job_id = _job_id ORDER BY created_at
  LOOP
    _has_services := true;
    INSERT INTO public.invoice_line_items
      (package_id, item_type, name, description, quantity, unit_price,
       taxable, is_optional, is_selected, discount_allowed, display_order)
    VALUES
      (_pkg_id, 'service', _service.service_category, COALESCE(_service.notes,''),
       _service.quantity, COALESCE(_service.unit_price, 0),
       true, false, true, true, 0);
  END LOOP;

  IF NOT _has_services THEN
    INSERT INTO public.invoice_line_items
      (package_id, item_type, name, description, quantity, unit_price, display_order)
    VALUES
      (_pkg_id, 'service', COALESCE(NULLIF(_job.service_category,''), 'Services rendered'),
       '', 1, COALESCE(_job.payout, 0), 0);
  END IF;

  UPDATE public.jobs SET status='ConvertedToInvoice' WHERE id = _job_id;
  INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_user_id, note)
    VALUES (_job_id, _job.status, 'ConvertedToInvoice', auth.uid(), 'Converted to invoice ' || _invoice_no);

  INSERT INTO public.invoice_events (invoice_id, event_type, actor_user_id, details)
  VALUES (_invoice_id, 'created_from_job', auth.uid(),
          jsonb_build_object('job_id', _job_id, 'job_number', _job.job_number));

  RETURN jsonb_build_object('success', true, 'invoice_id', _invoice_id, 'invoice_number', _invoice_no);
END;
$$;
GRANT EXECUTE ON FUNCTION public.convert_job_to_invoice(uuid) TO authenticated;

-- Helper to upsert manual discount (admin)
CREATE OR REPLACE FUNCTION public.add_invoice_manual_discount(
  _invoice_id uuid, _scope text, _kind text, _value numeric, _reason text DEFAULT '',
  _package_id uuid DEFAULT NULL, _line_item_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  INSERT INTO public.invoice_discounts (invoice_id, scope, kind, value, reason, package_id, line_item_id)
  VALUES (_invoice_id, _scope, _kind, _value, _reason, _package_id, _line_item_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_invoice_manual_discount(uuid, text, text, numeric, text, uuid, uuid) TO authenticated;