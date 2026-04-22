CREATE OR REPLACE FUNCTION public.delete_job(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run_ids uuid[];
BEGIN
  IF NOT is_admin_or_owner(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id) THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  -- Delete storage objects under job-photos/{job_id}/
  DELETE FROM storage.objects
   WHERE bucket_id = 'job-photos'
     AND name LIKE (_job_id::text || '/%');

  -- Collect allocation run ids for this job
  SELECT array_agg(id) INTO _run_ids
    FROM public.allocation_runs
   WHERE job_id = _job_id;

  IF _run_ids IS NOT NULL THEN
    DELETE FROM public.allocation_run_candidates
     WHERE allocation_run_id = ANY(_run_ids);
  END IF;

  DELETE FROM public.offers              WHERE job_id = _job_id;
  DELETE FROM public.job_photos          WHERE job_id = _job_id;
  DELETE FROM public.job_services        WHERE job_id = _job_id;
  DELETE FROM public.job_status_events   WHERE job_id = _job_id;
  DELETE FROM public.job_assignments     WHERE job_id = _job_id;
  DELETE FROM public.allocation_runs     WHERE job_id = _job_id;
  DELETE FROM public.jobs                WHERE id     = _job_id;

  RETURN jsonb_build_object('success', true);
END;
$$;