-- ============================================================
-- Customer Invoices module
-- ============================================================

-- 1. Extend app_settings with branding + invoice defaults
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS next_invoice_number integer NOT NULL DEFAULT 1001,
  ADD COLUMN IF NOT EXISTS default_tax_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS default_payment_terms text NOT NULL DEFAULT 'Payment due within 15 days.';

-- 2. customer_invoices
CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  job_id uuid,
  customer_id uuid,
  status text NOT NULL DEFAULT 'Draft',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_pct numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  payment_terms text NOT NULL DEFAULT '',
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  paid_at timestamptz,
  paid_by_user_id uuid,
  payment_method text NOT NULL DEFAULT '',
  payment_reference text NOT NULL DEFAULT '',
  pdf_storage_path text NOT NULL DEFAULT '',
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_invoices_status ON public.customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_job ON public.customer_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer ON public.customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_share_token ON public.customer_invoices(share_token);

-- Validation trigger (no CHECK constraint per platform rule on time-sensitive validations,
-- and to keep status values flexible).
CREATE OR REPLACE FUNCTION public.tg_validate_customer_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('Draft','Sent','Paid','Void') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', NEW.status;
  END IF;
  IF NEW.subtotal < 0 OR NEW.tax_pct < 0 OR NEW.tax_amount < 0 OR NEW.total < 0 THEN
    RAISE EXCEPTION 'Invoice amounts must be non-negative';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_customer_invoices_validate ON public.customer_invoices;
CREATE TRIGGER tg_customer_invoices_validate
  BEFORE INSERT OR UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_customer_invoice();

DROP TRIGGER IF EXISTS tg_customer_invoices_updated_at ON public.customer_invoices;
CREATE TRIGGER tg_customer_invoices_updated_at
  BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.customer_invoices;
CREATE POLICY "Admin full access"
  ON public.customer_invoices FOR ALL
  TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

-- 3. customer_invoice_line_items
CREATE TABLE IF NOT EXISTS public.customer_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON public.customer_invoice_line_items(invoice_id);

ALTER TABLE public.customer_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.customer_invoice_line_items;
CREATE POLICY "Admin full access"
  ON public.customer_invoice_line_items FOR ALL
  TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

-- 4. Allow new job statuses ConvertedToInvoice and InvoiceSent
-- The existing `enforce_sp_job_update` trigger only restricts non-admin updates,
-- so admins can already set arbitrary statuses. We add a permissive validation
-- to make the allowed set explicit and document the new states.
CREATE OR REPLACE FUNCTION public.tg_validate_job_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN (
    'Created','Offered','Assigned','Accepted','InProgress',
    'Completed','Cancelled','Expired','Archived',
    'ConvertedToInvoice','InvoiceSent'
  ) THEN
    RAISE EXCEPTION 'Invalid job status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_jobs_validate_status ON public.jobs;
CREATE TRIGGER tg_jobs_validate_status
  BEFORE INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_job_status();

-- 5. Sequential invoice number generator
CREATE OR REPLACE FUNCTION public.next_customer_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _n int;
BEGIN
  UPDATE public.app_settings
     SET next_invoice_number = next_invoice_number + 1
   WHERE id = 1
   RETURNING next_invoice_number - 1 INTO _n;

  IF _n IS NULL THEN
    -- Fallback if app_settings row missing
    INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    UPDATE public.app_settings SET next_invoice_number = 1002 WHERE id = 1
      RETURNING 1001 INTO _n;
  END IF;

  RETURN 'INV-' || LPAD(_n::text, 4, '0');
END;
$$;

-- 6. Convert a completed job to a draft customer invoice
CREATE OR REPLACE FUNCTION public.convert_job_to_invoice(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job RECORD;
  _settings RECORD;
  _invoice_id uuid;
  _invoice_no text;
  _subtotal numeric := 0;
  _tax_amt numeric := 0;
  _total numeric := 0;
  _service RECORD;
  _has_services boolean := false;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO _job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF _job.status NOT IN ('Completed','ConvertedToInvoice') THEN
    RETURN jsonb_build_object('error', 'Only completed jobs can be converted to invoice');
  END IF;

  -- Reuse existing draft invoice if one already exists for this job
  SELECT id INTO _invoice_id
    FROM public.customer_invoices
   WHERE job_id = _job_id AND status = 'Draft'
   LIMIT 1;

  IF _invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invoice_id', _invoice_id, 'reused', true);
  END IF;

  SELECT * INTO _settings FROM public.app_settings WHERE id = 1;

  _invoice_no := public.next_customer_invoice_number();

  INSERT INTO public.customer_invoices
    (invoice_number, job_id, customer_id, status,
     subtotal, tax_pct, tax_amount, total,
     payment_terms, created_by_user_id)
  VALUES
    (_invoice_no, _job.id, _job.customer_id, 'Draft',
     0, COALESCE(_settings.default_tax_pct, 5), 0, 0,
     COALESCE(_settings.default_payment_terms, ''), auth.uid())
  RETURNING id INTO _invoice_id;

  -- Copy line items from job_services
  FOR _service IN
    SELECT service_category, quantity, unit_price, line_total, notes
      FROM public.job_services
     WHERE job_id = _job_id
     ORDER BY created_at
  LOOP
    _has_services := true;
    INSERT INTO public.customer_invoice_line_items
      (invoice_id, description, quantity, unit_price, line_total, display_order)
    VALUES
      (_invoice_id,
       _service.service_category || COALESCE(' — ' || NULLIF(_service.notes,''), ''),
       _service.quantity,
       COALESCE(_service.unit_price, 0),
       COALESCE(_service.line_total, 0),
       0);
    _subtotal := _subtotal + COALESCE(_service.line_total, 0);
  END LOOP;

  -- Fallback: one line for the whole job payout if no job_services exist
  IF NOT _has_services THEN
    INSERT INTO public.customer_invoice_line_items
      (invoice_id, description, quantity, unit_price, line_total, display_order)
    VALUES
      (_invoice_id,
       COALESCE(NULLIF(_job.service_category,''), 'Services rendered'),
       1, COALESCE(_job.payout, 0), COALESCE(_job.payout, 0), 0);
    _subtotal := COALESCE(_job.payout, 0);
  END IF;

  _tax_amt := ROUND((_subtotal * COALESCE(_settings.default_tax_pct, 5) / 100.0)::numeric, 2);
  _total := _subtotal + _tax_amt;

  UPDATE public.customer_invoices
     SET subtotal = _subtotal,
         tax_amount = _tax_amt,
         total = _total
   WHERE id = _invoice_id;

  -- Flip job status
  UPDATE public.jobs SET status = 'ConvertedToInvoice' WHERE id = _job_id;
  INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_user_id, note)
    VALUES (_job_id, _job.status, 'ConvertedToInvoice', auth.uid(), 'Converted to invoice ' || _invoice_no);

  RETURN jsonb_build_object('success', true, 'invoice_id', _invoice_id, 'invoice_number', _invoice_no);
END;
$$;

-- 7. Mark invoice sent (called by the send-customer-invoice edge function or admin UI)
CREATE OR REPLACE FUNCTION public.mark_customer_invoice_sent(_invoice_id uuid, _pdf_path text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv RECORD;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO _inv FROM public.customer_invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;

  UPDATE public.customer_invoices
     SET status = 'Sent',
         sent_at = now(),
         pdf_storage_path = CASE WHEN _pdf_path = '' THEN pdf_storage_path ELSE _pdf_path END
   WHERE id = _invoice_id;

  IF _inv.job_id IS NOT NULL THEN
    UPDATE public.jobs SET status = 'InvoiceSent' WHERE id = _inv.job_id;
    INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_user_id, note)
      VALUES (_inv.job_id, 'ConvertedToInvoice', 'InvoiceSent', auth.uid(), 'Invoice ' || _inv.invoice_number || ' sent');
  END IF;

  RETURN jsonb_build_object('success', true, 'share_token', _inv.share_token);
END;
$$;

-- 8. Public read by share token (no auth)
CREATE OR REPLACE FUNCTION public.get_customer_invoice_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv RECORD;
  _customer RECORD;
  _settings RECORD;
  _items jsonb;
BEGIN
  SELECT * INTO _inv FROM public.customer_invoices WHERE share_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invoice not found');
  END IF;
  IF _inv.status = 'Draft' THEN
    RETURN jsonb_build_object('error', 'Invoice not yet sent');
  END IF;

  SELECT name, email, address_street, address_city, address_region, address_postal
    INTO _customer FROM public.customers WHERE id = _inv.customer_id;

  SELECT company_name, company_address, company_email, company_phone, company_logo_url
    INTO _settings FROM public.app_settings WHERE id = 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'description', description,
      'quantity', quantity,
      'unit_price', unit_price,
      'line_total', line_total
    ) ORDER BY display_order, created_at), '[]'::jsonb)
    INTO _items
    FROM public.customer_invoice_line_items
   WHERE invoice_id = _inv.id;

  RETURN jsonb_build_object(
    'invoice', jsonb_build_object(
      'invoice_number', _inv.invoice_number,
      'status', _inv.status,
      'subtotal', _inv.subtotal,
      'tax_pct', _inv.tax_pct,
      'tax_amount', _inv.tax_amount,
      'total', _inv.total,
      'notes', _inv.notes,
      'payment_terms', _inv.payment_terms,
      'sent_at', _inv.sent_at,
      'paid_at', _inv.paid_at
    ),
    'customer', to_jsonb(_customer),
    'company', to_jsonb(_settings),
    'line_items', _items
  );
END;
$$;

-- 9. Storage bucket for invoice PDFs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-invoices', 'customer-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can read/write invoice PDFs
DROP POLICY IF EXISTS "Admins manage invoice PDFs" ON storage.objects;
CREATE POLICY "Admins manage invoice PDFs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'customer-invoices' AND is_admin_or_owner(auth.uid()))
  WITH CHECK (bucket_id = 'customer-invoices' AND is_admin_or_owner(auth.uid()));
