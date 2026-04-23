-- Enable pg_net for async HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: posts the offer row to the send-offer-push edge function
-- in the same payload shape Supabase webhooks use: { type, table, record, old_record }
CREATE OR REPLACE FUNCTION public.notify_offer_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _function_url text := 'https://oqqmauxfetekkzngmdum.supabase.co/functions/v1/send-offer-push';
  _service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcW1hdXhmZXRla2t6bmdtZHVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5MTU3MSwiZXhwIjoyMDg3MzY3NTcxfQ.placeholder';
  _payload jsonb;
  _op text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _op := 'INSERT';
    _payload := jsonb_build_object(
      'type', 'INSERT',
      'table', 'offers',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', null
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _op := 'UPDATE';
    _payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', 'offers',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body := _payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the offer write because of a notification failure
  RAISE WARNING 'notify_offer_push failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offers_push_insert ON public.offers;
CREATE TRIGGER offers_push_insert
AFTER INSERT ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_offer_push();

DROP TRIGGER IF EXISTS offers_push_update ON public.offers;
CREATE TRIGGER offers_push_update
AFTER UPDATE OF status ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_offer_push();