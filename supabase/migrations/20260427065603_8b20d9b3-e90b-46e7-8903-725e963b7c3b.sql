-- 1. Extend jobs with deposit + estimate linkage fields
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deposit_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_received numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_received_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS source_estimate_id uuid;

-- 2. Replace convert_estimate_to_job with version that carries totals + deposit + category
CREATE OR REPLACE FUNCTION public.convert_estimate_to_job(
  _estimate_id uuid,
  _mode text,
  _existing_job_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est public.estimates%ROWTYPE;
  v_cust public.customers%ROWTYPE;
  v_pkg public.estimate_packages%ROWTYPE;
  v_job_id uuid;
  v_job_num text;
  v_jnum integer;
  v_item record;
  v_total numeric;
  v_deposit numeric;
  v_first_name text;
  v_service_category text;
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

  SELECT * INTO v_pkg FROM public.estimate_packages WHERE id = v_est.accepted_package_id;

  v_total   := COALESCE(v_est.accepted_total, 0);
  v_deposit := COALESCE(v_est.accepted_deposit, 0);

  SELECT name INTO v_first_name
  FROM public.estimate_line_items
  WHERE package_id = v_est.accepted_package_id AND is_selected = true
  ORDER BY display_order LIMIT 1;

  v_service_category := COALESCE(NULLIF(v_pkg.name, 'Package'), NULLIF(v_pkg.name, ''), NULLIF(v_first_name, ''), '');

  IF _mode = 'new' THEN
    SELECT * INTO v_cust FROM public.customers WHERE id = v_est.customer_id;
    SELECT COALESCE(MAX(NULLIF(regexp_replace(job_number, '\D', '', 'g'), '')::int), 1000) + 1
      INTO v_jnum FROM public.jobs;
    v_job_num := 'JOB-' || lpad(v_jnum::text, 4, '0');

    INSERT INTO public.jobs (
      job_number, customer_id, customer_property_id, assigned_sp_id,
      service_category, status, urgency, notes,
      job_address_street, job_address_city, job_address_region,
      job_address_postal, job_address_country, job_lat, job_lng,
      payout, deposit_due, source_estimate_id
    ) VALUES (
      v_job_num, v_est.customer_id, v_est.customer_property_id, v_est.assigned_sp_id,
      v_service_category, 'Created', 'Scheduled',
      COALESCE(v_est.customer_notes, ''),
      COALESCE(v_cust.address_street, ''), COALESCE(v_cust.address_city, ''),
      COALESCE(v_cust.address_region, ''), COALESCE(v_cust.address_postal, ''),
      COALESCE(v_cust.address_country, 'Canada'), v_cust.address_lat, v_cust.address_lng,
      v_total, v_deposit, _estimate_id
    ) RETURNING id INTO v_job_id;
  ELSIF _mode = 'attach' THEN
    IF _existing_job_id IS NULL THEN
      RETURN jsonb_build_object('error', 'job_id required for attach mode');
    END IF;
    v_job_id := _existing_job_id;
    DELETE FROM public.job_services WHERE job_id = v_job_id;
    UPDATE public.jobs
      SET payout = v_total,
          deposit_due = v_deposit,
          source_estimate_id = _estimate_id,
          service_category = COALESCE(NULLIF(service_category,''), v_service_category)
      WHERE id = v_job_id;
  ELSE
    RETURN jsonb_build_object('error', 'Invalid mode');
  END IF;

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
  VALUES (_estimate_id, 'converted', auth.uid(),
          jsonb_build_object('mode', _mode, 'job_id', v_job_id,
                             'total', v_total, 'deposit_due', v_deposit));

  RETURN jsonb_build_object(
    'success', true,
    'job_id', v_job_id,
    'total', v_total,
    'deposit_due', v_deposit
  );
END;
$$;

-- 3. RPC for admins to record deposit received against a job (record-only)
CREATE OR REPLACE FUNCTION public.record_job_deposit(
  _job_id uuid,
  _amount numeric,
  _method text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _amount IS NULL OR _amount < 0 THEN
    RETURN jsonb_build_object('error', 'Invalid amount');
  END IF;

  UPDATE public.jobs SET
    deposit_received = _amount,
    deposit_received_at = CASE WHEN _amount > 0 THEN now() ELSE NULL END,
    deposit_received_by_user_id = CASE WHEN _amount > 0 THEN auth.uid() ELSE NULL END
  WHERE id = _job_id;

  RETURN jsonb_build_object('success', true);
END;
$$;