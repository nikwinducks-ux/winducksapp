
-- =========================================================================
-- Customer Activity Log
-- =========================================================================

CREATE TABLE public.customer_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  job_id uuid NULL,
  event_type text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NULL,
  actor_email text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cust_activity_customer_created
  ON public.customer_activity_log (customer_id, created_at DESC);
CREATE INDEX idx_cust_activity_job
  ON public.customer_activity_log (job_id);

ALTER TABLE public.customer_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access"
  ON public.customer_activity_log
  FOR ALL
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own job activity"
  ON public.customer_activity_log
  FOR SELECT
  TO authenticated
  USING (
    job_id IS NOT NULL AND (
      job_id IN (SELECT id FROM public.jobs WHERE assigned_sp_id = public.get_user_sp_id(auth.uid()))
      OR public.sp_on_job_crew(public.get_user_sp_id(auth.uid()), job_id)
    )
  );

-- =========================================================================
-- Helpers
-- =========================================================================

CREATE OR REPLACE FUNCTION public._actor_info()
RETURNS TABLE(user_id uuid, email text, role text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _email text := '';
  _role text := '';
BEGIN
  _uid := auth.uid();
  IF _uid IS NOT NULL THEN
    SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;
    SELECT ur.role::text INTO _role FROM public.user_roles ur
      WHERE ur.user_id = _uid AND ur.is_active = true
      ORDER BY CASE ur.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
      LIMIT 1;
  END IF;
  RETURN QUERY SELECT _uid, COALESCE(_email,''), COALESCE(_role,'');
END;
$$;

CREATE OR REPLACE FUNCTION public._log_customer_activity(
  _customer_id uuid,
  _job_id uuid,
  _event_type text,
  _summary text,
  _details jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a record;
BEGIN
  IF _customer_id IS NULL THEN RETURN; END IF;
  SELECT * INTO _a FROM public._actor_info();
  INSERT INTO public.customer_activity_log
    (customer_id, job_id, event_type, summary, details, actor_user_id, actor_email, actor_role)
  VALUES
    (_customer_id, _job_id, _event_type, _summary, COALESCE(_details, '{}'::jsonb),
     _a.user_id, _a.email, _a.role);
END;
$$;

-- =========================================================================
-- Trigger: jobs
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_log_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sp_old text;
  _sp_new text;
  _label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
    _label := COALESCE(NULLIF(NEW.job_number,''), 'Job');
    PERFORM public._log_customer_activity(
      NEW.customer_id, NEW.id, 'job_created',
      _label || ' created',
      jsonb_build_object('job_number', NEW.job_number, 'status', NEW.status, 'urgency', NEW.urgency)
    );
    IF NEW.scheduled_date IS NOT NULL THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_scheduled',
        _label || ' scheduled for ' || NEW.scheduled_date::text || COALESCE(' ' || NULLIF(NEW.scheduled_time,''),''),
        jsonb_build_object('scheduled_date', NEW.scheduled_date, 'scheduled_time', NEW.scheduled_time)
      );
    END IF;
    IF NEW.assigned_sp_id IS NOT NULL THEN
      SELECT name INTO _sp_new FROM service_providers WHERE id = NEW.assigned_sp_id;
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_assigned',
        _label || ' assigned to ' || COALESCE(_sp_new,'SP'),
        jsonb_build_object('sp_id', NEW.assigned_sp_id, 'sp_name', _sp_new)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
    _label := COALESCE(NULLIF(NEW.job_number,''), 'Job');

    IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date
       OR NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_rescheduled',
        _label || ' rescheduled: ' ||
          COALESCE(OLD.scheduled_date::text,'—') || ' ' || COALESCE(NULLIF(OLD.scheduled_time,''),'') ||
          ' → ' ||
          COALESCE(NEW.scheduled_date::text,'—') || ' ' || COALESCE(NULLIF(NEW.scheduled_time,''),''),
        jsonb_build_object(
          'from', jsonb_build_object('date', OLD.scheduled_date, 'time', OLD.scheduled_time),
          'to',   jsonb_build_object('date', NEW.scheduled_date, 'time', NEW.scheduled_time)
        )
      );
    END IF;

    IF NEW.assigned_sp_id IS DISTINCT FROM OLD.assigned_sp_id THEN
      SELECT name INTO _sp_old FROM service_providers WHERE id = OLD.assigned_sp_id;
      SELECT name INTO _sp_new FROM service_providers WHERE id = NEW.assigned_sp_id;
      IF NEW.assigned_sp_id IS NULL THEN
        PERFORM public._log_customer_activity(
          NEW.customer_id, NEW.id, 'job_unassigned',
          _label || ' unassigned from ' || COALESCE(_sp_old,'SP'),
          jsonb_build_object('previous_sp_id', OLD.assigned_sp_id, 'previous_sp_name', _sp_old)
        );
      ELSE
        PERFORM public._log_customer_activity(
          NEW.customer_id, NEW.id, 'job_assigned',
          _label || ' assigned to ' || COALESCE(_sp_new,'SP'),
          jsonb_build_object(
            'previous_sp_id', OLD.assigned_sp_id, 'previous_sp_name', _sp_old,
            'sp_id', NEW.assigned_sp_id, 'sp_name', _sp_new
          )
        );
      END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'Completed' THEN
        PERFORM public._log_customer_activity(
          NEW.customer_id, NEW.id, 'job_completed',
          _label || ' completed',
          jsonb_build_object('from', OLD.status, 'to', NEW.status)
        );
      ELSIF NEW.status = 'Cancelled' THEN
        PERFORM public._log_customer_activity(
          NEW.customer_id, NEW.id, 'job_cancelled',
          _label || ' cancelled',
          jsonb_build_object('from', OLD.status, 'to', NEW.status)
        );
      ELSE
        PERFORM public._log_customer_activity(
          NEW.customer_id, NEW.id, 'job_status_changed',
          _label || ' status: ' || OLD.status || ' → ' || NEW.status,
          jsonb_build_object('from', OLD.status, 'to', NEW.status)
        );
      END IF;
    END IF;

    IF NEW.payout IS DISTINCT FROM OLD.payout THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_payout_changed',
        _label || ' payout: $' || OLD.payout::text || ' → $' || NEW.payout::text,
        jsonb_build_object('from', OLD.payout, 'to', NEW.payout)
      );
    END IF;

    IF NEW.job_address_street IS DISTINCT FROM OLD.job_address_street
       OR NEW.job_address_city IS DISTINCT FROM OLD.job_address_city
       OR NEW.job_address_region IS DISTINCT FROM OLD.job_address_region
       OR NEW.job_address_postal IS DISTINCT FROM OLD.job_address_postal THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_address_changed',
        _label || ' address updated',
        jsonb_build_object(
          'from', jsonb_build_object('street', OLD.job_address_street, 'city', OLD.job_address_city, 'region', OLD.job_address_region, 'postal', OLD.job_address_postal),
          'to',   jsonb_build_object('street', NEW.job_address_street, 'city', NEW.job_address_city, 'region', NEW.job_address_region, 'postal', NEW.job_address_postal)
        )
      );
    END IF;

    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_notes_changed',
        _label || ' notes updated',
        jsonb_build_object('from', OLD.notes, 'to', NEW.notes)
      );
    END IF;

    IF NEW.urgency IS DISTINCT FROM OLD.urgency THEN
      PERFORM public._log_customer_activity(
        NEW.customer_id, NEW.id, 'job_urgency_changed',
        _label || ' urgency: ' || OLD.urgency || ' → ' || NEW.urgency,
        jsonb_build_object('from', OLD.urgency, 'to', NEW.urgency)
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NULL THEN RETURN OLD; END IF;
    PERFORM public._log_customer_activity(
      OLD.customer_id, NULL, 'job_deleted',
      COALESCE(NULLIF(OLD.job_number,''),'Job') || ' deleted',
      jsonb_build_object('job_id', OLD.id, 'job_number', OLD.job_number, 'status', OLD.status)
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_jobs_ins AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_jobs();
CREATE TRIGGER trg_log_jobs_upd AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_jobs();
CREATE TRIGGER trg_log_jobs_del AFTER DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_jobs();

-- =========================================================================
-- Trigger: job_services
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_log_job_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_id uuid;
  _job_number text;
  _label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT customer_id, job_number INTO _customer_id, _job_number FROM jobs WHERE id = OLD.job_id;
    IF _customer_id IS NULL THEN RETURN OLD; END IF;
    _label := COALESCE(NULLIF(_job_number,''),'Job');
    PERFORM public._log_customer_activity(
      _customer_id, OLD.job_id, 'service_removed',
      _label || ': removed ' || OLD.service_category || ' (qty ' || OLD.quantity || ')',
      jsonb_build_object('service_category', OLD.service_category, 'quantity', OLD.quantity, 'unit_price', OLD.unit_price, 'line_total', OLD.line_total)
    );
    RETURN OLD;
  END IF;

  SELECT customer_id, job_number INTO _customer_id, _job_number FROM jobs WHERE id = NEW.job_id;
  IF _customer_id IS NULL THEN RETURN NEW; END IF;
  _label := COALESCE(NULLIF(_job_number,''),'Job');

  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_customer_activity(
      _customer_id, NEW.job_id, 'service_added',
      _label || ': added ' || NEW.service_category || ' (qty ' || NEW.quantity || ', $' || COALESCE(NEW.line_total::text,'0') || ')',
      jsonb_build_object('service_category', NEW.service_category, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price, 'line_total', NEW.line_total, 'notes', NEW.notes)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.service_category IS DISTINCT FROM OLD.service_category
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
       OR NEW.line_total IS DISTINCT FROM OLD.line_total
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      PERFORM public._log_customer_activity(
        _customer_id, NEW.job_id, 'service_updated',
        _label || ': updated ' || NEW.service_category,
        jsonb_build_object(
          'from', jsonb_build_object('service_category', OLD.service_category, 'quantity', OLD.quantity, 'unit_price', OLD.unit_price, 'line_total', OLD.line_total, 'notes', OLD.notes),
          'to',   jsonb_build_object('service_category', NEW.service_category, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price, 'line_total', NEW.line_total, 'notes', NEW.notes)
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_job_services AFTER INSERT OR UPDATE OR DELETE ON public.job_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_job_services();

-- =========================================================================
-- Trigger: job_photos
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_log_job_photos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_id uuid;
  _job_number text;
  _label text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT customer_id, job_number INTO _customer_id, _job_number FROM jobs WHERE id = OLD.job_id;
    IF _customer_id IS NULL THEN RETURN OLD; END IF;
    _label := COALESCE(NULLIF(_job_number,''),'Job');
    PERFORM public._log_customer_activity(
      _customer_id, OLD.job_id, 'photo_removed',
      _label || ': photo removed',
      jsonb_build_object('storage_path', OLD.storage_path, 'caption', OLD.caption)
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT customer_id, job_number INTO _customer_id, _job_number FROM jobs WHERE id = NEW.job_id;
    IF _customer_id IS NULL THEN RETURN NEW; END IF;
    _label := COALESCE(NULLIF(_job_number,''),'Job');
    PERFORM public._log_customer_activity(
      _customer_id, NEW.job_id, 'photo_added',
      _label || ': photo added' || COALESCE(' — ' || NULLIF(NEW.caption,''),''),
      jsonb_build_object('storage_path', NEW.storage_path, 'caption', NEW.caption)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_job_photos AFTER INSERT OR DELETE ON public.job_photos
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_job_photos();

-- =========================================================================
-- Trigger: customers
-- =========================================================================

CREATE OR REPLACE FUNCTION public.tg_log_customers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_customer_activity(
      NEW.id, NULL, 'customer_created',
      'Customer created: ' || NEW.name,
      jsonb_build_object('name', NEW.name, 'email', NEW.email, 'phone', NEW.phone)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      _changes := _changes || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      _changes := _changes || jsonb_build_object('email', jsonb_build_object('from', OLD.email, 'to', NEW.email));
    END IF;
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      _changes := _changes || jsonb_build_object('phone', jsonb_build_object('from', OLD.phone, 'to', NEW.phone));
    END IF;
    IF NEW.notes IS DISTINCT FROM OLD.notes THEN
      _changes := _changes || jsonb_build_object('notes', jsonb_build_object('from', OLD.notes, 'to', NEW.notes));
    END IF;
    IF NEW.tags IS DISTINCT FROM OLD.tags THEN
      _changes := _changes || jsonb_build_object('tags', jsonb_build_object('from', to_jsonb(OLD.tags), 'to', to_jsonb(NEW.tags)));
    END IF;
    IF NEW.address_street IS DISTINCT FROM OLD.address_street
       OR NEW.address_city IS DISTINCT FROM OLD.address_city
       OR NEW.address_region IS DISTINCT FROM OLD.address_region
       OR NEW.address_postal IS DISTINCT FROM OLD.address_postal THEN
      _changes := _changes || jsonb_build_object('address', jsonb_build_object(
        'from', jsonb_build_object('street', OLD.address_street, 'city', OLD.address_city, 'region', OLD.address_region, 'postal', OLD.address_postal),
        'to',   jsonb_build_object('street', NEW.address_street, 'city', NEW.address_city, 'region', NEW.address_region, 'postal', NEW.address_postal)
      ));
    END IF;

    IF _changes <> '{}'::jsonb THEN
      PERFORM public._log_customer_activity(
        NEW.id, NULL, 'customer_updated',
        'Customer profile updated',
        _changes
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_customers AFTER INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_customers();
