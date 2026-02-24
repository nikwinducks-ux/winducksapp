
-- Update has_role() to enforce is_active = true
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Helper: check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'owner'
      AND is_active = true
  )
$$;

-- Helper: admin OR owner (active only)
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'owner')
      AND is_active = true
  )
$$;

-- Update ALL admin RLS policies to use is_admin_or_owner
DROP POLICY IF EXISTS "Admin full access" ON public.allocation_policies;
CREATE POLICY "Admin full access" ON public.allocation_policies
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.allocation_run_candidates;
CREATE POLICY "Admin full access" ON public.allocation_run_candidates
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.allocation_runs;
CREATE POLICY "Admin full access" ON public.allocation_runs
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.availability_events;
CREATE POLICY "Admin full access" ON public.availability_events
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.customers;
CREATE POLICY "Admin full access" ON public.customers
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.job_assignments;
CREATE POLICY "Admin full access" ON public.job_assignments
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.job_services;
CREATE POLICY "Admin full access" ON public.job_services
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.job_status_events;
CREATE POLICY "Admin full access" ON public.job_status_events
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.jobs;
CREATE POLICY "Admin full access" ON public.jobs
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.offers;
CREATE POLICY "Admin full access" ON public.offers
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.service_categories;
CREATE POLICY "Admin full access" ON public.service_categories
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.service_providers;
CREATE POLICY "Admin full access" ON public.service_providers
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.sp_availability;
CREATE POLICY "Admin full access" ON public.sp_availability
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

DROP POLICY IF EXISTS "Admin full access" ON public.user_roles;
CREATE POLICY "Admin full access" ON public.user_roles
  FOR ALL USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));
