CREATE OR REPLACE FUNCTION public.enforce_sp_job_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_privileged boolean;
  _sp_id uuid;
  _is_member boolean;
  _protected_fields_unchanged boolean;
  _allow_internal_assignment_sync boolean;
BEGIN
  _is_privileged := is_admin_or_owner(auth.uid());

  IF NOT _is_privileged THEN
    _sp_id := get_user_sp_id(auth.uid());
    _is_member := (OLD.assigned_sp_id = _sp_id) OR (NEW.assigned_sp_id = _sp_id) OR sp_on_job_crew(_sp_id, NEW.id);
    _protected_fields_unchanged :=
      NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id
      AND NEW.payout IS NOT DISTINCT FROM OLD.payout
      AND NEW.job_address_street IS NOT DISTINCT FROM OLD.job_address_street
      AND NEW.job_address_city IS NOT DISTINCT FROM OLD.job_address_city
      AND NEW.job_address_region IS NOT DISTINCT FROM OLD.job_address_region
      AND NEW.job_address_postal IS NOT DISTINCT FROM OLD.job_address_postal
      AND NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date
      AND NEW.scheduled_time IS NOT DISTINCT FROM OLD.scheduled_time
      AND NEW.service_category IS NOT DISTINCT FROM OLD.service_category
      AND NEW.notes IS NOT DISTINCT FROM OLD.notes
      AND NEW.urgency IS NOT DISTINCT FROM OLD.urgency
      AND NEW.is_broadcast IS NOT DISTINCT FROM OLD.is_broadcast
      AND NEW.broadcast_radius_km IS NOT DISTINCT FROM OLD.broadcast_radius_km
      AND NEW.broadcast_note IS NOT DISTINCT FROM OLD.broadcast_note
      AND NEW.started_at IS NOT DISTINCT FROM OLD.started_at
      AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at;

    _allow_internal_assignment_sync :=
      _protected_fields_unchanged
      AND (
        (
          NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id
          AND (
            (OLD.status = 'Created' AND NEW.status = 'Assigned')
            OR (OLD.status = 'Offered' AND NEW.status = 'Assigned')
            OR (OLD.status = 'Offered' AND NEW.status = 'Offered')
            OR (OLD.status = 'Accepted' AND NEW.status = 'Accepted')
            OR (OLD.status = 'Assigned' AND NEW.status = 'Assigned')
          )
        )
        OR (
          NEW.assigned_sp_id IS NOT NULL
          AND NEW.assigned_sp_id IS NOT DISTINCT FROM OLD.assigned_sp_id
          AND OLD.status = 'Offered'
          AND NEW.status = 'Assigned'
        )
      );

    IF NOT _is_member AND NOT _allow_internal_assignment_sync THEN
      RAISE EXCEPTION 'SP not authorized to update this job';
    END IF;

    IF NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id AND NOT _allow_internal_assignment_sync THEN
      RAISE EXCEPTION 'SP cannot change assigned_sp_id';
    END IF;
    IF NEW.payout IS DISTINCT FROM OLD.payout THEN
      RAISE EXCEPTION 'SP cannot change payout';
    END IF;
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
      RAISE EXCEPTION 'SP cannot change customer_id';
    END IF;
    IF NEW.job_address_street IS DISTINCT FROM OLD.job_address_street
       OR NEW.job_address_city IS DISTINCT FROM OLD.job_address_city
       OR NEW.job_address_region IS DISTINCT FROM OLD.job_address_region
       OR NEW.job_address_postal IS DISTINCT FROM OLD.job_address_postal THEN
      RAISE EXCEPTION 'SP cannot change job address';
    END IF;
    IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
       OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN
      RAISE EXCEPTION 'SP cannot change schedule';
    END IF;
    IF NEW.service_category IS DISTINCT FROM OLD.service_category THEN
      RAISE EXCEPTION 'SP cannot change service category';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT _allow_internal_assignment_sync THEN
      IF NOT (
        (OLD.status IN ('Assigned', 'Accepted') AND NEW.status = 'InProgress') OR
        (OLD.status IN ('Assigned', 'Accepted', 'InProgress') AND NEW.status = 'Completed')
      ) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'InProgress' AND OLD.status != 'InProgress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF _job.assigned_sp_id IS NOT NULL AND _job.assigned_sp_id <> _sp_id THEN
    RETURN jsonb_build_object('error', 'Job already assigned');
  END IF;

  UPDATE offers
     SET status = 'Accepted', responded_at = now(), acceptance_source = 'Manual'
   WHERE id = _offer_id;

  UPDATE offers
     SET status = 'Cancelled'
   WHERE job_id = _offer.job_id
     AND status = 'Pending'
     AND id != _offer_id;

  INSERT INTO job_crew_members (job_id, sp_id, is_lead)
    VALUES (_offer.job_id, _sp_id, true)
    ON CONFLICT (job_id, sp_id) DO UPDATE SET is_lead = true;

  UPDATE jobs
     SET assigned_sp_id = _sp_id,
         status = CASE
           WHEN status IN ('Created', 'Offered', 'Accepted') THEN 'Assigned'
           ELSE status
         END
   WHERE id = _offer.job_id;

  INSERT INTO job_assignments (job_id, sp_id, assignment_type)
    VALUES (_offer.job_id, _sp_id, 'Offer');

  INSERT INTO job_status_events (job_id, old_status, new_status, changed_by_sp_id)
    VALUES (
      _offer.job_id,
      _job.status,
      CASE
        WHEN _job.status IN ('Created', 'Offered', 'Accepted') THEN 'Assigned'
        ELSE _job.status
      END,
      _sp_id
    );

  IF _offer.allocation_run_id IS NOT NULL THEN
    UPDATE allocation_runs
       SET selected_sp_id = _sp_id,
           finalized_at = now()
     WHERE id = _offer.allocation_run_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'job_id', _offer.job_id);
END;
$function$;

UPDATE public.jobs j
   SET status = 'Assigned'
 WHERE j.status = 'Offered'
   AND j.assigned_sp_id IS NOT NULL
   AND EXISTS (
     SELECT 1
       FROM public.offers o
      WHERE o.job_id = j.id
        AND o.sp_id = j.assigned_sp_id
        AND o.status = 'Accepted'
   );