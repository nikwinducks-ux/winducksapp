-- 1. Allow ReadyToInvoice in convert_job_to_invoice
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
  IF _job.status NOT IN ('Completed','ReadyToInvoice','ConvertedToInvoice','InvoiceSent') THEN
    RETURN jsonb_build_object('error','Only completed jobs can be converted to invoice');
  END IF;

  SELECT id INTO _existing FROM public.customer_invoices
   WHERE job_id = _job_id AND status = 'Draft' LIMIT 1;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invoice_id', _existing, 'reused', true);
  END IF;

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

-- 2. Helper to mark a job ready to invoice
CREATE OR REPLACE FUNCTION public.mark_job_ready_to_invoice(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _job RECORD;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error','Not authorized');
  END IF;
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Job not found'); END IF;
  IF _job.status NOT IN ('Completed','ReadyToInvoice') THEN
    RETURN jsonb_build_object('error','Job must be Completed first');
  END IF;
  UPDATE public.jobs SET status='ReadyToInvoice' WHERE id = _job_id;
  INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_user_id, note)
    VALUES (_job_id, _job.status, 'ReadyToInvoice', auth.uid(), 'Marked ready to invoice');
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_job_ready_to_invoice(uuid) TO authenticated;

-- 3. Strengthen convert_estimate_to_job to prevent duplicate conversions
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
  IF v_est.status NOT IN ('Accepted') THEN
    RETURN jsonb_build_object('error', 'Estimate must be Accepted before converting');
  END IF;
  IF v_est.converted_job_id IS NOT NULL AND _mode = 'new' THEN
    RETURN jsonb_build_object('error', 'Estimate already converted to job ' || v_est.converted_job_id::text);
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
GRANT EXECUTE ON FUNCTION public.convert_estimate_to_job(uuid, text, uuid) TO authenticated;