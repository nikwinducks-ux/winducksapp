
-- Create admin audit logs table
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin/owner can read
CREATE POLICY "Admin read audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (is_admin_or_owner(auth.uid()));

-- Only service role (edge functions) can insert — no direct client inserts
-- We'll insert from the edge function using service role key
