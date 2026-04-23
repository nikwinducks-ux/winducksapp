CREATE OR REPLACE FUNCTION public.get_review_by_token(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r RECORD;
  _sp_name text;
  _job RECORD;
  _customer_name text;
  _services text;
BEGIN
  SELECT * INTO _r FROM job_reviews WHERE review_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid review link');
  END IF;

  SELECT name INTO _sp_name FROM service_providers WHERE id = _r.sp_id;

  SELECT job_number, scheduled_date, scheduled_time,
         job_address_city, job_address_region,
         service_category, completed_at
    INTO _job FROM jobs WHERE id = _r.job_id;

  SELECT name INTO _customer_name FROM customers WHERE id = _r.customer_id;

  SELECT string_agg(service_category, ', ' ORDER BY created_at)
    INTO _services
    FROM job_services
    WHERE job_id = _r.job_id;

  IF _services IS NULL OR _services = '' THEN
    _services := COALESCE(_job.service_category, '');
  END IF;

  RETURN jsonb_build_object(
    'status', _r.status,
    'sp_name', COALESCE(_sp_name, 'your service provider'),
    'job_number', COALESCE(_job.job_number, ''),
    'submitted_at', _r.submitted_at,
    'service_summary', _services,
    'scheduled_date', _job.scheduled_date,
    'scheduled_time', _job.scheduled_time,
    'job_address_city', _job.job_address_city,
    'job_address_region', _job.job_address_region,
    'customer_name', COALESCE(_customer_name, ''),
    'completed_at', _job.completed_at
  );
END;
$function$;