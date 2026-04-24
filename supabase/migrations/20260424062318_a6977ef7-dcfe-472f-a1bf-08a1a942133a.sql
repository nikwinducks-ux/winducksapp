CREATE OR REPLACE FUNCTION public.notify_offer_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _function_url text := 'https://oqqmauxfetekkzngmdum.supabase.co/functions/v1/send-offer-push';
  _service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcW1hdXhmZXRla2t6bmdtZHVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc5MTU3MSwiZXhwIjoyMDg3MzY3NTcxfQ.placeholder';
  _payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _payload := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', null
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _payload := jsonb_build_object(
      'type', 'UPDATE',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
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
  RAISE WARNING 'notify_offer_push failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;