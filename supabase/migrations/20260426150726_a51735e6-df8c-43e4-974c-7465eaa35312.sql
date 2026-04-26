
CREATE TABLE public.job_visits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid NOT NULL,
  sp_id         uuid NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz NULL,
  duration_secs integer NULL,
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_visits_job_id ON public.job_visits(job_id);
CREATE INDEX idx_job_visits_sp_id  ON public.job_visits(sp_id);
CREATE INDEX idx_job_visits_open   ON public.job_visits(job_id) WHERE ended_at IS NULL;

ALTER TABLE public.job_visits ENABLE ROW LEVEL SECURITY;

-- Admin/owner full access
CREATE POLICY "Admin full access"
  ON public.job_visits
  FOR ALL
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

-- SP can read visits on jobs they're on
CREATE POLICY "SP select visits on own jobs"
  ON public.job_visits
  FOR SELECT
  TO authenticated
  USING (
    sp_id = get_user_sp_id(auth.uid())
    OR job_id IN (SELECT id FROM public.jobs WHERE assigned_sp_id = get_user_sp_id(auth.uid()))
    OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  );

-- SP can start a visit on a job they're on
CREATE POLICY "SP insert own visits"
  ON public.job_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sp_id = get_user_sp_id(auth.uid())
    AND (
      job_id IN (SELECT id FROM public.jobs WHERE assigned_sp_id = get_user_sp_id(auth.uid()))
      OR sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
    )
  );

-- SP can end their own open visits
CREATE POLICY "SP update own visits"
  ON public.job_visits
  FOR UPDATE
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()))
  WITH CHECK (sp_id = get_user_sp_id(auth.uid()));

-- Trigger: keep updated_at fresh and compute duration on end
CREATE OR REPLACE FUNCTION public.tg_job_visits_maintain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.ended_at IS NOT NULL THEN
    NEW.duration_secs := GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_visits_maintain
  BEFORE INSERT OR UPDATE ON public.job_visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_job_visits_maintain();

-- Trigger: when a visit is started on an Assigned/Accepted job, move job to InProgress
CREATE OR REPLACE FUNCTION public.tg_job_visits_start_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job RECORD;
BEGIN
  SELECT id, status INTO _job FROM public.jobs WHERE id = NEW.job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF _job.status IN ('Assigned', 'Accepted') THEN
    UPDATE public.jobs SET status = 'InProgress' WHERE id = NEW.job_id;
    INSERT INTO public.job_status_events (job_id, old_status, new_status, changed_by_sp_id, note)
      VALUES (NEW.job_id, _job.status, 'InProgress', NEW.sp_id, 'Auto: visit started');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_job_visits_start_progress
  AFTER INSERT ON public.job_visits
  FOR EACH ROW EXECUTE FUNCTION public.tg_job_visits_start_progress();
