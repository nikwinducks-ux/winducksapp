
-- Create job_photos table
CREATE TABLE public.job_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text NOT NULL DEFAULT '',
  uploaded_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_photos_job_id ON public.job_photos(job_id);

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access"
  ON public.job_photos
  FOR ALL
  USING (public.is_admin_or_owner(auth.uid()))
  WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select photos of assigned jobs"
  ON public.job_photos
  FOR SELECT
  USING (
    job_id IN (
      SELECT jobs.id FROM public.jobs
      WHERE jobs.assigned_sp_id = public.get_user_sp_id(auth.uid())
    )
  );

CREATE POLICY "SP select photos of broadcast jobs"
  ON public.job_photos
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'sp'::app_role)
    AND job_id IN (
      SELECT jobs.id FROM public.jobs
      WHERE public.sp_eligible_for_broadcast_job(public.get_user_sp_id(auth.uid()), jobs.id)
    )
  );

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job-photos bucket
CREATE POLICY "Public read job-photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'job-photos');

CREATE POLICY "Admin upload job-photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'job-photos' AND public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admin update job-photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'job-photos' AND public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admin delete job-photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'job-photos' AND public.is_admin_or_owner(auth.uid()));
