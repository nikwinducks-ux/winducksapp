-- See all crew rows for any job I'm on
CREATE POLICY "SP select crew for jobs I am on"
ON public.job_crew_members FOR SELECT TO authenticated
USING (
  sp_on_job_crew(get_user_sp_id(auth.uid()), job_id)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_crew_members.job_id
      AND j.assigned_sp_id = get_user_sp_id(auth.uid())
  )
);

-- See teammate SP profiles for jobs I'm on
CREATE POLICY "SP select teammates on shared jobs"
ON public.service_providers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.job_crew_members me
    JOIN public.job_crew_members mate ON mate.job_id = me.job_id
    WHERE me.sp_id = get_user_sp_id(auth.uid())
      AND mate.sp_id = service_providers.id
  )
);