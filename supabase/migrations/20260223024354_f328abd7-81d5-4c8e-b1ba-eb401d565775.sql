
-- Allocation policies table
CREATE TABLE public.allocation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name text NOT NULL,
  weights_json jsonb NOT NULL DEFAULT '{}',
  fairness_json jsonb NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid
);
ALTER TABLE public.allocation_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to allocation_policies" ON public.allocation_policies FOR ALL USING (true) WITH CHECK (true);

-- Allocation runs table
CREATE TABLE public.allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  policy_id uuid NOT NULL REFERENCES public.allocation_policies(id),
  selected_sp_id uuid REFERENCES public.service_providers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  label text DEFAULT ''
);
ALTER TABLE public.allocation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to allocation_runs" ON public.allocation_runs FOR ALL USING (true) WITH CHECK (true);

-- Allocation run candidates table
CREATE TABLE public.allocation_run_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_run_id uuid NOT NULL REFERENCES public.allocation_runs(id) ON DELETE CASCADE,
  sp_id uuid NOT NULL REFERENCES public.service_providers(id),
  factor_scores_json jsonb NOT NULL DEFAULT '{}',
  weighted_score numeric NOT NULL DEFAULT 0,
  fairness_adjustment numeric NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  rank integer NOT NULL DEFAULT 0,
  eligibility_status text NOT NULL DEFAULT 'Eligible',
  exclusion_reason text
);
ALTER TABLE public.allocation_run_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to allocation_run_candidates" ON public.allocation_run_candidates FOR ALL USING (true) WITH CHECK (true);

-- Seed the default policy
INSERT INTO public.allocation_policies (version_name, weights_json, fairness_json, active)
VALUES (
  'Policy v1.0',
  '{"availability":20,"proximity":15,"competency":15,"jobHistory":10,"customerRating":15,"reliability":10,"responsiveness":5,"safetyCompliance":5,"fairness":5}',
  '{"rollingWindow":30,"maxSharePercent":15,"cooldownHours":4,"minDistributionBoost":5,"newSpBoostDays":30}',
  true
);
