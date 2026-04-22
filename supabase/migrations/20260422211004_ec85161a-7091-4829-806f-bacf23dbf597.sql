CREATE OR REPLACE FUNCTION public.stop_broadcast(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job RECORD;
  _cancelled_count int := 0;
  _new_status text;
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO _job FROM public.jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Cancel pending offers
  WITH cancelled AS (
    UPDATE public.offers
       SET status = 'Cancelled', responded_at = now()
     WHERE job_id = _job_id AND status = 'Pending'
     RETURNING 1
  )
  SELECT count(*) INTO _cancelled_count FROM cancelled;

  -- Determine new status
  IF _job.status = 'Offered' AND _job.assigned_sp_id IS NULL THEN
    _new_status := 'Created';
  ELSE
    _new_status := _job.status;
  END IF;

  UPDATE public.jobs
     SET is_broadcast = false,
         status = _new_status
   WHERE id = _job_id;

  IF _new_status <> _job.status THEN
    INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_user_id, note)
    VALUES (_job_id, _job.status, _new_status, auth.uid(), 'Broadcast stopped');
  END IF;

  RETURN jsonb_build_object('success', true, 'cancelled_offer_count', _cancelled_count);
END;
$$;