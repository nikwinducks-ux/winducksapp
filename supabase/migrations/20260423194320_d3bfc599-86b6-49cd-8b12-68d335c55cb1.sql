CREATE OR REPLACE FUNCTION public.accept_offer(_offer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _offer RECORD;
  _job   RECORD;
  _sp_id uuid;
BEGIN
  _sp_id := get_user_sp_id(auth.uid());
  IF _sp_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No SP linked to your account');
  END IF;

  SELECT * INTO _offer FROM offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not found');
  END IF;

  IF _offer.sp_id != _sp_id THEN
    RETURN jsonb_build_object('error', 'This offer does not belong to you');
  END IF;

  IF _offer.status != 'Pending' THEN
    RETURN jsonb_build_object('error', 'Offer is no longer pending (status: ' || _offer.status || ')');
  END IF;

  IF _offer.expires_at < now() THEN
    UPDATE offers SET status = 'Expired' WHERE id = _offer_id;
    RETURN jsonb_build_object('error', 'Offer has expired');
  END IF;

  SELECT * INTO _job FROM jobs WHERE id = _offer.job_id FOR UPDATE;
  IF _job.assigned_sp_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Job already assigned');
  END IF;

  UPDATE offers SET status = 'Accepted', responded_at = now(), acceptance_source = 'Manual'
    WHERE id = _offer_id;

  UPDATE offers SET status = 'Cancelled'
    WHERE job_id = _offer.job_id AND status = 'Pending' AND id != _offer_id;

  -- Insert crew member (lead). Trigger keeps assigned_sp_id and status in sync.
  INSERT INTO job_crew_members (job_id, sp_id, is_lead)
    VALUES (_offer.job_id, _sp_id, true)
    ON CONFLICT (job_id, sp_id) DO UPDATE SET is_lead = true;

  -- Audit
  INSERT INTO job_assignments (job_id, sp_id, assignment_type)
    VALUES (_offer.job_id, _sp_id, 'Offer');

  INSERT INTO job_status_events (job_id, old_status, new_status, changed_by_sp_id)
    VALUES (_offer.job_id, _job.status, 'Assigned', _sp_id);

  IF _offer.allocation_run_id IS NOT NULL THEN
    UPDATE allocation_runs SET selected_sp_id = _sp_id, finalized_at = now()
      WHERE id = _offer.allocation_run_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'job_id', _offer.job_id);
END;
$function$;