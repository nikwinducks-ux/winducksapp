
-- 1. job_reviews table
CREATE TABLE public.job_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  sp_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  review_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | submitted
  on_time_score smallint,
  quality_score smallint,
  communication_score smallint,
  overall_rating numeric(3,2),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);

CREATE INDEX idx_job_reviews_sp_id ON public.job_reviews(sp_id);
CREATE INDEX idx_job_reviews_token ON public.job_reviews(review_token);
CREATE INDEX idx_job_reviews_status ON public.job_reviews(status);

-- Validation trigger (no CHECK constraints on score ranges to remain flexible)
CREATE OR REPLACE FUNCTION public.validate_job_review()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted' THEN
    IF NEW.on_time_score IS NULL OR NEW.on_time_score < 1 OR NEW.on_time_score > 5
       OR NEW.quality_score IS NULL OR NEW.quality_score < 1 OR NEW.quality_score > 5
       OR NEW.communication_score IS NULL OR NEW.communication_score < 1 OR NEW.communication_score > 5 THEN
      RAISE EXCEPTION 'Review scores must be between 1 and 5';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_job_review
BEFORE INSERT OR UPDATE ON public.job_reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_job_review();

-- 2. RLS
ALTER TABLE public.job_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON public.job_reviews
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own reviews" ON public.job_reviews
  FOR SELECT TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

-- 3. Public RPCs (token-based access)
CREATE OR REPLACE FUNCTION public.get_review_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r RECORD;
  _sp RECORD;
  _job RECORD;
BEGIN
  SELECT * INTO _r FROM job_reviews WHERE review_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid review link');
  END IF;

  SELECT name INTO _sp FROM service_providers WHERE id = _r.sp_id;
  SELECT job_number INTO _job FROM jobs WHERE id = _r.job_id;

  RETURN jsonb_build_object(
    'status', _r.status,
    'sp_name', COALESCE(_sp.name, 'your service provider'),
    'job_number', COALESCE(_job.job_number, ''),
    'submitted_at', _r.submitted_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_review(
  _token text,
  _on_time smallint,
  _quality smallint,
  _communication smallint,
  _comment text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r RECORD;
  _overall numeric(3,2);
BEGIN
  SELECT * INTO _r FROM job_reviews WHERE review_token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid review link');
  END IF;

  IF _r.status = 'submitted' THEN
    RETURN jsonb_build_object('error', 'This review has already been submitted');
  END IF;

  IF _on_time < 1 OR _on_time > 5 OR _quality < 1 OR _quality > 5
     OR _communication < 1 OR _communication > 5 THEN
    RETURN jsonb_build_object('error', 'Scores must be between 1 and 5');
  END IF;

  _overall := ROUND(((_on_time + _quality + _communication)::numeric / 3.0), 2);

  UPDATE job_reviews
     SET on_time_score = _on_time,
         quality_score = _quality,
         communication_score = _communication,
         overall_rating = _overall,
         comment = COALESCE(_comment, ''),
         status = 'submitted',
         submitted_at = now()
   WHERE id = _r.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(text, smallint, smallint, smallint, text) TO anon, authenticated;

-- 4. Recompute SP scores when a review is submitted
CREATE OR REPLACE FUNCTION public.recompute_sp_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg_rating numeric;
  _avg_ontime numeric;
  _avg_quality numeric;
  _avg_comm numeric;
  _reliability numeric;
  _completed int;
  _total_assigned int;
  _completion numeric;
BEGIN
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    -- already counted; still allow recompute on edits
    NULL;
  END IF;

  -- Last 30 submitted reviews for this SP
  WITH recent AS (
    SELECT * FROM job_reviews
     WHERE sp_id = NEW.sp_id AND status = 'submitted'
     ORDER BY submitted_at DESC
     LIMIT 30
  )
  SELECT AVG(overall_rating), AVG(on_time_score), AVG(quality_score), AVG(communication_score)
    INTO _avg_rating, _avg_ontime, _avg_quality, _avg_comm
    FROM recent;

  _reliability := ROUND(((_avg_ontime * 0.5 + _avg_quality * 0.3 + _avg_comm * 0.2) * 20)::numeric);

  -- Completion rate over last 30 assigned-and-resolved jobs
  SELECT COUNT(*) FILTER (WHERE status = 'Completed'),
         COUNT(*)
    INTO _completed, _total_assigned
    FROM (
      SELECT status FROM jobs
       WHERE assigned_sp_id = NEW.sp_id
         AND status IN ('Completed', 'Cancelled')
       ORDER BY COALESCE(completed_at, updated_at) DESC
       LIMIT 30
    ) j;

  IF _total_assigned > 0 THEN
    _completion := ROUND((_completed::numeric / _total_assigned) * 100);
  ELSE
    _completion := NULL;
  END IF;

  UPDATE service_providers
     SET rating = COALESCE(ROUND(_avg_rating::numeric, 2), rating),
         on_time_rate = COALESCE(ROUND(_avg_ontime * 20)::int, on_time_rate),
         reliability_score = COALESCE(_reliability::int, reliability_score),
         completion_rate = COALESCE(_completion::int, completion_rate),
         updated_at = now()
   WHERE id = NEW.sp_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recompute_sp_scores
AFTER INSERT OR UPDATE ON public.job_reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_sp_scores();

-- 5. When a job flips to Completed, create a pending review and queue email
CREATE OR REPLACE FUNCTION public.create_review_on_job_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _sp RECORD;
  _token text;
  _review_id uuid;
  _site_url text := 'https://winducksapp.lovable.app';
BEGIN
  IF NEW.status <> 'Completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'Completed') THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_sp_id IS NULL OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't double-create
  IF EXISTS (SELECT 1 FROM job_reviews WHERE job_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT name, email INTO _customer FROM customers WHERE id = NEW.customer_id;
  SELECT name INTO _sp FROM service_providers WHERE id = NEW.assigned_sp_id;

  _token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO job_reviews (job_id, sp_id, customer_id, review_token)
    VALUES (NEW.id, NEW.assigned_sp_id, NEW.customer_id, _token)
    RETURNING id INTO _review_id;

  -- Skip email send when no customer email
  IF _customer.email IS NULL OR _customer.email = '' THEN
    RETURN NEW;
  END IF;

  -- Enqueue review request email via shared transactional queue
  BEGIN
    PERFORM enqueue_email('transactional_emails', jsonb_build_object(
      'templateName', 'review-request',
      'recipientEmail', _customer.email,
      'idempotencyKey', 'review-request-' || _review_id::text,
      'templateData', jsonb_build_object(
        'customerName', COALESCE(_customer.name, ''),
        'spName', COALESCE(_sp.name, 'your service provider'),
        'jobNumber', COALESCE(NEW.job_number, ''),
        'reviewUrl', _site_url || '/review/' || _token
      )
    ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to enqueue review email: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_review_on_job_complete
AFTER INSERT OR UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.create_review_on_job_complete();
