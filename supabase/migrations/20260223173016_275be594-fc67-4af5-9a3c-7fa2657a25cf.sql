
-- ============================================================
-- Phase 1: Replace ALL permissive RLS policies with role-based
-- ============================================================

-- ──────────────── user_roles ────────────────
DROP POLICY IF EXISTS "Allow all access for prototype" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admin full access" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own role" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ──────────────── service_providers ────────────────
DROP POLICY IF EXISTS "Allow all access to service_providers" ON public.service_providers;

CREATE POLICY "Admin full access" ON public.service_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own" ON public.service_providers FOR SELECT TO authenticated
  USING (id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP update own" ON public.service_providers FOR UPDATE TO authenticated
  USING (id = public.get_user_sp_id(auth.uid()))
  WITH CHECK (id = public.get_user_sp_id(auth.uid()));

-- ──────────────── jobs ────────────────
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;

CREATE POLICY "Admin full access" ON public.jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select assigned jobs" ON public.jobs FOR SELECT TO authenticated
  USING (assigned_sp_id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP select broadcast jobs" ON public.jobs FOR SELECT TO authenticated
  USING (is_broadcast = true AND status = 'Created');

-- ──────────────── offers ────────────────
DROP POLICY IF EXISTS "Allow all access to offers" ON public.offers;

CREATE POLICY "Admin full access" ON public.offers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own offers" ON public.offers FOR SELECT TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP update own offers" ON public.offers FOR UPDATE TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()))
  WITH CHECK (sp_id = public.get_user_sp_id(auth.uid()));

-- ──────────────── customers ────────────────
DROP POLICY IF EXISTS "Allow all access to customers" ON public.customers;

CREATE POLICY "Admin full access" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select customers of assigned jobs" ON public.customers FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT customer_id FROM public.jobs
      WHERE assigned_sp_id = public.get_user_sp_id(auth.uid())
        AND customer_id IS NOT NULL
    )
  );

-- ──────────────── sp_availability ────────────────
DROP POLICY IF EXISTS "Allow all access to sp_availability" ON public.sp_availability;

CREATE POLICY "Admin full access" ON public.sp_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own availability" ON public.sp_availability FOR SELECT TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP update own availability" ON public.sp_availability FOR UPDATE TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()))
  WITH CHECK (sp_id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP insert own availability" ON public.sp_availability FOR INSERT TO authenticated
  WITH CHECK (sp_id = public.get_user_sp_id(auth.uid()));

-- ──────────────── availability_events ────────────────
DROP POLICY IF EXISTS "Allow all access to availability_events" ON public.availability_events;

CREATE POLICY "Admin full access" ON public.availability_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own events" ON public.availability_events FOR SELECT TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()));

CREATE POLICY "SP insert own events" ON public.availability_events FOR INSERT TO authenticated
  WITH CHECK (sp_id = public.get_user_sp_id(auth.uid()));

-- ──────────────── job_assignments ────────────────
DROP POLICY IF EXISTS "Allow all access to job_assignments" ON public.job_assignments;

CREATE POLICY "Admin full access" ON public.job_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own assignments" ON public.job_assignments FOR SELECT TO authenticated
  USING (sp_id = public.get_user_sp_id(auth.uid()));

-- ──────────────── job_status_events ────────────────
DROP POLICY IF EXISTS "Allow all access to job_status_events" ON public.job_status_events;

CREATE POLICY "Admin full access" ON public.job_status_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select own status events" ON public.job_status_events FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs
      WHERE assigned_sp_id = public.get_user_sp_id(auth.uid())
    )
  );

CREATE POLICY "SP insert own status events" ON public.job_status_events FOR INSERT TO authenticated
  WITH CHECK (
    changed_by_sp_id = public.get_user_sp_id(auth.uid())
  );

-- ──────────────── allocation_policies ────────────────
DROP POLICY IF EXISTS "Allow all access to allocation_policies" ON public.allocation_policies;

CREATE POLICY "Admin full access" ON public.allocation_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────── allocation_runs ────────────────
DROP POLICY IF EXISTS "Allow all access to allocation_runs" ON public.allocation_runs;

CREATE POLICY "Admin full access" ON public.allocation_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────── allocation_run_candidates ────────────────
DROP POLICY IF EXISTS "Allow all access to allocation_run_candidates" ON public.allocation_run_candidates;

CREATE POLICY "Admin full access" ON public.allocation_run_candidates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────── service_categories ────────────────
DROP POLICY IF EXISTS "Allow all access to service_categories" ON public.service_categories;

CREATE POLICY "Admin full access" ON public.service_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "SP select active categories" ON public.service_categories FOR SELECT TO authenticated
  USING (active = true);
