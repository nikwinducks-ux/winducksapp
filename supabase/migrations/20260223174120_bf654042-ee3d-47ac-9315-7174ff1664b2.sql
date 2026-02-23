
-- ============================================================
-- A) Replace broadcast job RLS with eligibility-gated function
-- B) Lock down offers via accept_offer / decline_offer RPCs
-- ============================================================

-- ── A: Haversine distance helper ──
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371.0 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians(lng2 - lng1) / 2) ^ 2
  ))
$$;

-- ── A: Eligibility check function ──
CREATE OR REPLACE FUNCTION public.sp_eligible_for_broadcast_job(
  _sp_id uuid, _job_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sp RECORD;
  _job RECORD;
  _dist double precision;
  _max_radius double precision;
BEGIN
  SELECT id, status, compliance_status, categories, base_lat, base_lng,
         service_radius_km, base_address_city, base_address_postal
    INTO _sp FROM service_providers WHERE id = _sp_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT id, is_broadcast, status, service_category, job_lat, job_lng,
         broadcast_radius_km, job_address_city, job_address_postal
    INTO _job FROM jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Must be broadcast and in offerable state
  IF NOT _job.is_broadcast THEN RETURN false; END IF;
  IF _job.status NOT IN ('Created', 'Offered') THEN RETURN false; END IF;

  -- SP must be active and compliant
  IF _sp.status != 'Active' THEN RETURN false; END IF;
  IF _sp.compliance_status != 'Valid' THEN RETURN false; END IF;

  -- Category match
  IF NOT (_job.service_category = ANY(_sp.categories)) THEN RETURN false; END IF;

  -- Proximity: coordinates first
  IF _sp.base_lat IS NOT NULL AND _sp.base_lng IS NOT NULL
     AND _job.job_lat IS NOT NULL AND _job.job_lng IS NOT NULL THEN
    _dist := haversine_km(_sp.base_lat, _sp.base_lng, _job.job_lat, _job.job_lng);
    _max_radius := LEAST(_job.broadcast_radius_km, _sp.service_radius_km);
    IF _dist > _max_radius THEN RETURN false; END IF;
  ELSE
    -- Fallback: require same city or same postal prefix
    IF _sp.base_address_city != '' AND _job.job_address_city != '' THEN
      IF lower(trim(_sp.base_address_city)) != lower(trim(_job.job_address_city)) THEN
        -- Try postal prefix (first 3 chars for Canadian FSA)
        IF left(_sp.base_address_postal, 3) != left(_job.job_address_postal, 3) THEN
          RETURN false;
        END IF;
      END IF;
    ELSE
      -- No location data at all — deny
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- ── A: Drop old open broadcast policy, create gated one ──
DROP POLICY IF EXISTS "SP select broadcast jobs" ON public.jobs;

CREATE POLICY "SP select eligible broadcast jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'sp')
    AND public.sp_eligible_for_broadcast_job(
      public.get_user_sp_id(auth.uid()), id
    )
  );

-- ── B: Remove SP UPDATE policy on offers ──
DROP POLICY IF EXISTS "SP update own offers" ON public.offers;

-- ── B: accept_offer RPC ──
CREATE OR REPLACE FUNCTION public.accept_offer(_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offer RECORD;
  _job   RECORD;
  _sp_id uuid;
BEGIN
  _sp_id := get_user_sp_id(auth.uid());
  IF _sp_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No SP linked to your account');
  END IF;

  -- Lock the offer row
  SELECT * INTO _offer FROM offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Offer not found');
  END IF;

  -- Ownership
  IF _offer.sp_id != _sp_id THEN
    RETURN jsonb_build_object('error', 'This offer does not belong to you');
  END IF;

  -- Status must be Pending
  IF _offer.status != 'Pending' THEN
    RETURN jsonb_build_object('error', 'Offer is no longer pending (status: ' || _offer.status || ')');
  END IF;

  -- Expiry check
  IF _offer.expires_at < now() THEN
    UPDATE offers SET status = 'Expired' WHERE id = _offer_id;
    RETURN jsonb_build_object('error', 'Offer has expired');
  END IF;

  -- Lock the job
  SELECT * INTO _job FROM jobs WHERE id = _offer.job_id FOR UPDATE;
  IF _job.assigned_sp_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Job already assigned');
  END IF;

  -- Accept the offer
  UPDATE offers SET status = 'Accepted', responded_at = now(), acceptance_source = 'Manual'
    WHERE id = _offer_id;

  -- Cancel other pending offers
  UPDATE offers SET status = 'Cancelled'
    WHERE job_id = _offer.job_id AND status = 'Pending' AND id != _offer_id;

  -- Assign the job
  UPDATE jobs SET assigned_sp_id = _sp_id, status = 'Assigned'
    WHERE id = _offer.job_id;

  -- Audit
  INSERT INTO job_assignments (job_id, sp_id, assignment_type)
    VALUES (_offer.job_id, _sp_id, 'Offer');

  INSERT INTO job_status_events (job_id, old_status, new_status, changed_by_sp_id)
    VALUES (_offer.job_id, _job.status, 'Assigned', _sp_id);

  -- Finalize allocation run if present
  IF _offer.allocation_run_id IS NOT NULL THEN
    UPDATE allocation_runs SET selected_sp_id = _sp_id, finalized_at = now()
      WHERE id = _offer.allocation_run_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'job_id', _offer.job_id);
END;
$$;

-- ── B: decline_offer RPC ──
CREATE OR REPLACE FUNCTION public.decline_offer(_offer_id uuid, _reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _offer RECORD;
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
    RETURN jsonb_build_object('error', 'Offer is no longer pending');
  END IF;

  UPDATE offers SET status = 'Declined', responded_at = now(), decline_reason = _reason
    WHERE id = _offer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_offer(uuid, text) TO authenticated;
