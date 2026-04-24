
ALTER FUNCTION public.sync_customer_name() SET search_path = 'public';
ALTER FUNCTION public.sync_customer_primary_address() SET search_path = 'public';
ALTER FUNCTION public.tg_log_customer_properties() SET search_path = 'public';
ALTER FUNCTION public.tg_log_customer_contacts() SET search_path = 'public';
