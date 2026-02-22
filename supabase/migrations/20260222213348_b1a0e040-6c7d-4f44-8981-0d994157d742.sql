
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sp');

-- User roles table (per security best practices - separate from profiles)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  sp_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get SP id for a user
CREATE OR REPLACE FUNCTION public.get_user_sp_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'sp'
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow all access for prototype"
  ON public.user_roles FOR ALL
  USING (true) WITH CHECK (true);

-- Job assignments audit table
CREATE TABLE public.job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  sp_id uuid REFERENCES public.service_providers(id) ON DELETE CASCADE NOT NULL,
  assigned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assignment_type text NOT NULL DEFAULT 'Manual',
  notes text DEFAULT ''
);

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to job_assignments"
  ON public.job_assignments FOR ALL
  USING (true) WITH CHECK (true);
