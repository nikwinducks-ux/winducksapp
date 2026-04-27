
-- 1. Add compensation pct columns to service_providers
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS comp_platform_fee_pct numeric,
  ADD COLUMN IF NOT EXISTS comp_marketing_pct numeric,
  ADD COLUMN IF NOT EXISTS comp_sp_portion_pct numeric;

-- 2. Add global defaults to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS default_platform_fee_pct numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS default_marketing_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS default_sp_portion_pct numeric NOT NULL DEFAULT 65;

-- 3. New expenses table
CREATE TABLE IF NOT EXISTS public.sp_compensation_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  expense_type text NOT NULL DEFAULT 'percent_of_sp',
  value numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sp_comp_exp_type_chk CHECK (expense_type IN ('percent_of_sp','monthly_fixed')),
  CONSTRAINT sp_comp_exp_value_chk CHECK (value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sp_comp_exp_sp ON public.sp_compensation_expenses(sp_id);

ALTER TABLE public.sp_compensation_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.sp_compensation_expenses;
CREATE POLICY "Admin full access"
  ON public.sp_compensation_expenses FOR ALL
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "SP select own expenses" ON public.sp_compensation_expenses;
CREATE POLICY "SP select own expenses"
  ON public.sp_compensation_expenses FOR SELECT
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

DROP TRIGGER IF EXISTS tg_sp_comp_exp_updated_at ON public.sp_compensation_expenses;
CREATE TRIGGER tg_sp_comp_exp_updated_at
  BEFORE UPDATE ON public.sp_compensation_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Extend sp_invoices with breakdown columns
ALTER TABLE public.sp_invoices
  ADD COLUMN IF NOT EXISTS platform_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketing_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_sp_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expense_deduction_amount numeric NOT NULL DEFAULT 0;

-- 5. Update invoice generation trigger to use new compensation model
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
  _settings RECORD;
  _sp_id uuid;
  _platform_pct numeric;
  _marketing_pct numeric;
  _sp_pct numeric;
  _platform_amt numeric;
  _marketing_amt numeric;
  _gross_sp numeric;
  _expense_pct_total numeric;
  _expense_deduction numeric;
  _net numeric;
  _legacy_fee_pct numeric;
  _legacy_fee_amt numeric;
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

  SELECT default_payout_fee_percent,
         default_platform_fee_pct,
         default_marketing_pct,
         default_sp_portion_pct
    INTO _settings
    FROM public.app_settings WHERE id = 1;

  FOREACH _sp_id IN ARRAY _crew_ids LOOP
    SELECT COALESCE(comp_platform_fee_pct, _settings.default_platform_fee_pct, 15),
           COALESCE(comp_marketing_pct,    _settings.default_marketing_pct,    20),
           COALESCE(comp_sp_portion_pct,   _settings.default_sp_portion_pct,   65)
      INTO _platform_pct, _marketing_pct, _sp_pct
      FROM public.service_providers WHERE id = _sp_id;

    _platform_amt := ROUND((_gross * _platform_pct / 100.0)::numeric, 2);
    _marketing_amt := ROUND((_gross * _marketing_pct / 100.0)::numeric, 2);
    _gross_sp := ROUND((_gross * _sp_pct / 100.0)::numeric, 2);

    -- Sum active percent_of_sp expenses (capped at 100%)
    SELECT COALESCE(SUM(value), 0) INTO _expense_pct_total
      FROM public.sp_compensation_expenses
     WHERE sp_id = _sp_id AND active = true AND expense_type = 'percent_of_sp';
    _expense_pct_total := LEAST(_expense_pct_total, 100);
    _expense_deduction := ROUND((_gross_sp * _expense_pct_total / 100.0)::numeric, 2);

    _net := _gross_sp - _expense_deduction;

    -- Legacy columns kept populated for backward-compat (Payouts.tsx etc)
    _legacy_fee_pct := _platform_pct + _marketing_pct;
    _legacy_fee_amt := _platform_amt + _marketing_amt + _expense_deduction;

    INSERT INTO public.sp_invoices
      (job_id, sp_id, customer_id,
       gross_amount, fee_percent, fee_amount, net_amount,
       platform_fee_amount, marketing_amount, gross_sp_amount, expense_deduction_amount)
    VALUES
      (NEW.id, _sp_id, NEW.customer_id,
       _gross, _legacy_fee_pct, _legacy_fee_amt, _net,
       _platform_amt, _marketing_amt, _gross_sp, _expense_deduction)
    ON CONFLICT (job_id, sp_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;
