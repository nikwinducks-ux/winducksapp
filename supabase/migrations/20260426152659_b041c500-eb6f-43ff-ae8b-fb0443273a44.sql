-- Per-SP fee override
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS payout_fee_percent numeric;

-- Global default settings (singleton)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  default_payout_fee_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

INSERT INTO public.app_settings (id, default_payout_fee_percent)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.app_settings;
CREATE POLICY "Anyone authenticated can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage settings" ON public.app_settings;
CREATE POLICY "Admin manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

-- Invoices
CREATE TABLE IF NOT EXISTS public.sp_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  sp_id uuid NOT NULL,
  customer_id uuid,
  gross_amount numeric NOT NULL DEFAULT 0,
  fee_percent numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid','Paid')),
  paid_at timestamptz,
  paid_by_user_id uuid,
  payment_method text NOT NULL DEFAULT '',
  payment_reference text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, sp_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_invoices_sp_status ON public.sp_invoices(sp_id, status);
CREATE INDEX IF NOT EXISTS idx_sp_invoices_job ON public.sp_invoices(job_id);

ALTER TABLE public.sp_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.sp_invoices;
CREATE POLICY "Admin full access"
  ON public.sp_invoices FOR ALL
  TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select own invoices" ON public.sp_invoices;
CREATE POLICY "SP select own invoices"
  ON public.sp_invoices FOR SELECT
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS tg_sp_invoices_updated_at ON public.sp_invoices;
CREATE TRIGGER tg_sp_invoices_updated_at
  BEFORE UPDATE ON public.sp_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate invoices on job completion
CREATE OR REPLACE FUNCTION public.tg_generate_invoices_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _crew_ids uuid[];
  _crew_size int;
  _gross numeric;
  _global_fee numeric;
  _sp_id uuid;
  _fee_pct numeric;
  _fee_amt numeric;
  _net numeric;
BEGIN
  IF NEW.status <> 'Completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Completed' THEN RETURN NEW; END IF;

  SELECT array_agg(sp_id) INTO _crew_ids
    FROM public.job_crew_members WHERE job_id = NEW.id;

  IF _crew_ids IS NULL OR array_length(_crew_ids, 1) IS NULL THEN
    IF NEW.assigned_sp_id IS NULL THEN RETURN NEW; END IF;
    _crew_ids := ARRAY[NEW.assigned_sp_id];
  END IF;

  _crew_size := array_length(_crew_ids, 1);
  _gross := ROUND((COALESCE(NEW.payout, 0) / GREATEST(_crew_size, 1))::numeric, 2);

  SELECT COALESCE(default_payout_fee_percent, 0) INTO _global_fee
    FROM public.app_settings WHERE id = 1;
  _global_fee := COALESCE(_global_fee, 0);

  FOREACH _sp_id IN ARRAY _crew_ids LOOP
    SELECT COALESCE(payout_fee_percent, _global_fee) INTO _fee_pct
      FROM public.service_providers WHERE id = _sp_id;
    _fee_pct := COALESCE(_fee_pct, _global_fee);
    _fee_amt := ROUND((_gross * _fee_pct / 100.0)::numeric, 2);
    _net := _gross - _fee_amt;

    INSERT INTO public.sp_invoices
      (job_id, sp_id, customer_id, gross_amount, fee_percent, fee_amount, net_amount)
    VALUES
      (NEW.id, _sp_id, NEW.customer_id, _gross, _fee_pct, _fee_amt, _net)
    ON CONFLICT (job_id, sp_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_jobs_generate_invoices ON public.jobs;
CREATE TRIGGER tg_jobs_generate_invoices
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_generate_invoices_on_complete();