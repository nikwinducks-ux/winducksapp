-- 1. Table
CREATE TABLE public.sp_unavailable_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  block_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sp_unavailable_blocks_sp_date
  ON public.sp_unavailable_blocks (sp_id, block_date);

-- 2. Validation trigger: HH:MM format and end > start
CREATE OR REPLACE FUNCTION public.validate_sp_unavailable_block()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.start_time !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
    RAISE EXCEPTION 'start_time must be HH:MM (got %)', NEW.start_time;
  END IF;
  IF NEW.end_time !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
    RAISE EXCEPTION 'end_time must be HH:MM (got %)', NEW.end_time;
  END IF;
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'end_time (%) must be after start_time (%)', NEW.end_time, NEW.start_time;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sp_unavailable_block
  BEFORE INSERT OR UPDATE ON public.sp_unavailable_blocks
  FOR EACH ROW EXECUTE FUNCTION public.validate_sp_unavailable_block();

-- 3. Audit trigger -> availability_events
CREATE OR REPLACE FUNCTION public.audit_sp_unavailable_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sp uuid;
  _changes jsonb;
  _note text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _sp := OLD.sp_id;
    _changes := jsonb_build_object('op', 'delete', 'old', to_jsonb(OLD));
    _note := 'Time off removed';
  ELSIF TG_OP = 'UPDATE' THEN
    _sp := NEW.sp_id;
    _changes := jsonb_build_object('op', 'update', 'old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    _note := 'Time off updated';
  ELSE
    _sp := NEW.sp_id;
    _changes := jsonb_build_object('op', 'insert', 'new', to_jsonb(NEW));
    _note := 'Time off added';
  END IF;

  INSERT INTO public.availability_events (sp_id, changed_by_user_id, changes_json, note)
    VALUES (_sp, auth.uid(), _changes, _note);

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_sp_unavailable_block
  AFTER INSERT OR UPDATE OR DELETE ON public.sp_unavailable_blocks
  FOR EACH ROW EXECUTE FUNCTION public.audit_sp_unavailable_block();

-- 4. RLS
ALTER TABLE public.sp_unavailable_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access"
  ON public.sp_unavailable_blocks
  FOR ALL
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own time off"
  ON public.sp_unavailable_blocks
  FOR SELECT
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

CREATE POLICY "SP insert own time off"
  ON public.sp_unavailable_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (sp_id = get_user_sp_id(auth.uid()));

CREATE POLICY "SP update own time off"
  ON public.sp_unavailable_blocks
  FOR UPDATE
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()))
  WITH CHECK (sp_id = get_user_sp_id(auth.uid()));

CREATE POLICY "SP delete own time off"
  ON public.sp_unavailable_blocks
  FOR DELETE
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

-- 5. Helper SQL functions for duration parsing & overlap test
CREATE OR REPLACE FUNCTION public.parse_duration_minutes(_d text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _n numeric;
  _l text;
BEGIN
  IF _d IS NULL OR _d = '' THEN RETURN 60; END IF;
  _l := lower(_d);
  -- Try "Xh" / "X.Yh"
  IF _l ~ '^[0-9]+(\.[0-9]+)?\s*h' THEN
    _n := substring(_l from '^([0-9]+(\.[0-9]+)?)')::numeric;
    RETURN GREATEST(15, round(_n * 60)::int);
  END IF;
  -- Try "Xm" / "X min"
  IF _l ~ '^[0-9]+\s*m' THEN
    _n := substring(_l from '^([0-9]+)')::numeric;
    RETURN GREATEST(15, _n::int);
  END IF;
  -- Pure number => minutes
  IF _l ~ '^[0-9]+(\.[0-9]+)?$' THEN
    _n := _l::numeric;
    RETURN GREATEST(15, round(_n)::int);
  END IF;
  RETURN 60;
END;
$$;

CREATE OR REPLACE FUNCTION public.hhmm_to_minutes(_t text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _t IS NULL OR _t = '' THEN NULL
    ELSE (split_part(_t, ':', 1)::int) * 60 + (split_part(_t, ':', 2)::int)
  END
$$;

CREATE OR REPLACE FUNCTION public.sp_unavailable_overlaps(
  _sp_id uuid,
  _date date,
  _start_minutes integer,
  _end_minutes integer
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sp_unavailable_blocks b
     WHERE b.sp_id = _sp_id
       AND b.block_date = _date
       AND hhmm_to_minutes(b.start_time) < _end_minutes
       AND hhmm_to_minutes(b.end_time)   > _start_minutes
  )
$$;

-- 6. Update sp_eligible_for_broadcast_job to honour unavailable blocks
CREATE OR REPLACE FUNCTION public.sp_eligible_for_broadcast_job(_sp_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sp RECORD;
  _job RECORD;
  _dist double precision;
  _max_radius double precision;
  _start_min int;
  _dur int;
BEGIN
  SELECT id, status, compliance_status, categories, base_lat, base_lng,
         service_radius_km, base_address_city, base_address_postal
    INTO _sp FROM service_providers WHERE id = _sp_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT id, is_broadcast, status, service_category, job_lat, job_lng,
         broadcast_radius_km, job_address_city, job_address_postal,
         scheduled_date, scheduled_time, estimated_duration
    INTO _job FROM jobs WHERE id = _job_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT _job.is_broadcast THEN RETURN false; END IF;
  IF _job.status NOT IN ('Created', 'Offered') THEN RETURN false; END IF;
  IF _sp.status != 'Active' THEN RETURN false; END IF;
  IF _sp.compliance_status != 'Valid' THEN RETURN false; END IF;
  IF NOT (_job.service_category = ANY(_sp.categories)) THEN RETURN false; END IF;

  IF _sp.base_lat IS NOT NULL AND _sp.base_lng IS NOT NULL
     AND _job.job_lat IS NOT NULL AND _job.job_lng IS NOT NULL THEN
    _dist := haversine_km(_sp.base_lat, _sp.base_lng, _job.job_lat, _job.job_lng);
    _max_radius := LEAST(_job.broadcast_radius_km, _sp.service_radius_km);
    IF _dist > _max_radius THEN RETURN false; END IF;
  ELSE
    IF _sp.base_address_city != '' AND _job.job_address_city != '' THEN
      IF lower(trim(_sp.base_address_city)) != lower(trim(_job.job_address_city)) THEN
        IF left(_sp.base_address_postal, 3) != left(_job.job_address_postal, 3) THEN
          RETURN false;
        END IF;
      END IF;
    ELSE
      RETURN false;
    END IF;
  END IF;

  -- NEW: Time-off block check (only when job has scheduled date+time)
  IF _job.scheduled_date IS NOT NULL AND _job.scheduled_time <> '' THEN
    _start_min := hhmm_to_minutes(_job.scheduled_time);
    _dur := parse_duration_minutes(_job.estimated_duration);
    IF _start_min IS NOT NULL AND sp_unavailable_overlaps(_sp_id, _job.scheduled_date, _start_min, _start_min + _dur) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;