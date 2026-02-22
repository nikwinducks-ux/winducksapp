
-- Customers table
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address_street text NOT NULL DEFAULT '',
  address_city text NOT NULL DEFAULT '',
  address_region text NOT NULL DEFAULT '',
  address_postal text NOT NULL DEFAULT '',
  address_country text NOT NULL DEFAULT 'Canada',
  address_lat double precision,
  address_lng double precision,
  notes text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service Providers table
CREATE TABLE public.service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  base_address_street text NOT NULL DEFAULT '',
  base_address_city text NOT NULL DEFAULT '',
  base_address_region text NOT NULL DEFAULT '',
  base_address_postal text NOT NULL DEFAULT '',
  base_address_country text NOT NULL DEFAULT 'Canada',
  base_lat double precision,
  base_lng double precision,
  service_radius_km integer NOT NULL DEFAULT 30,
  max_jobs_per_day integer NOT NULL DEFAULT 5,
  categories text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  compliance_status text NOT NULL DEFAULT 'Valid',
  insurance_expiry date,
  certifications text[] NOT NULL DEFAULT '{}',
  rating numeric(3,2) NOT NULL DEFAULT 0,
  reliability_score integer NOT NULL DEFAULT 0,
  completion_rate integer NOT NULL DEFAULT 0,
  on_time_rate integer NOT NULL DEFAULT 0,
  cancellation_rate integer NOT NULL DEFAULT 0,
  acceptance_rate integer NOT NULL DEFAULT 0,
  avg_response_time text NOT NULL DEFAULT '',
  fairness_share integer NOT NULL DEFAULT 0,
  fairness_status text NOT NULL DEFAULT 'Within Target',
  auto_accept boolean NOT NULL DEFAULT false,
  joined_date date,
  total_jobs_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Jobs table
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  assigned_sp_id uuid REFERENCES public.service_providers(id) ON DELETE SET NULL,
  service_category text NOT NULL DEFAULT '',
  scheduled_date date,
  scheduled_time text NOT NULL DEFAULT '',
  estimated_duration text NOT NULL DEFAULT '',
  payout numeric(10,2) NOT NULL DEFAULT 0,
  job_address_street text NOT NULL DEFAULT '',
  job_address_city text NOT NULL DEFAULT '',
  job_address_region text NOT NULL DEFAULT '',
  job_address_postal text NOT NULL DEFAULT '',
  job_address_country text NOT NULL DEFAULT 'Canada',
  job_lat double precision,
  job_lng double precision,
  status text NOT NULL DEFAULT 'Created',
  scores jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS but allow all access (prototype, no auth)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to service_providers" ON public.service_providers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_providers_updated_at BEFORE UPDATE ON public.service_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
