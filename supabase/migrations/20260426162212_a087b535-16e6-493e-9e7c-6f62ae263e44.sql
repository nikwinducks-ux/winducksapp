-- Compliance documents table
CREATE TABLE public.sp_compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sp_id uuid NOT NULL,
  name text NOT NULL,
  document_type text NOT NULL DEFAULT '',
  expires_on date,
  file_path text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sp_compliance_documents_sp_id ON public.sp_compliance_documents(sp_id);
CREATE INDEX idx_sp_compliance_documents_expires_on ON public.sp_compliance_documents(expires_on);

ALTER TABLE public.sp_compliance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access"
  ON public.sp_compliance_documents
  FOR ALL
  TO authenticated
  USING (is_admin_or_owner(auth.uid()))
  WITH CHECK (is_admin_or_owner(auth.uid()));

CREATE POLICY "SP select own compliance documents"
  ON public.sp_compliance_documents
  FOR SELECT
  TO authenticated
  USING (sp_id = get_user_sp_id(auth.uid()));

CREATE TRIGGER trg_sp_compliance_documents_updated_at
  BEFORE UPDATE ON public.sp_compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('sp-compliance', 'sp-compliance', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Admin/owner full access
CREATE POLICY "Admin manage sp-compliance objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'sp-compliance' AND is_admin_or_owner(auth.uid()))
  WITH CHECK (bucket_id = 'sp-compliance' AND is_admin_or_owner(auth.uid()));

-- SP can read their own folder: path is {sp_id}/...
CREATE POLICY "SP read own sp-compliance objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sp-compliance'
    AND (storage.foldername(name))[1] = get_user_sp_id(auth.uid())::text
  );