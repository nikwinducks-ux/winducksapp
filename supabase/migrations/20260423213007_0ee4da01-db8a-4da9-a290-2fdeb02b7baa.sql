ALTER FUNCTION public.validate_sp_unavailable_block() SET search_path TO 'public';
ALTER FUNCTION public.audit_sp_unavailable_block() SET search_path TO 'public';
ALTER FUNCTION public.parse_duration_minutes(text) SET search_path TO 'public';
ALTER FUNCTION public.hhmm_to_minutes(text) SET search_path TO 'public';
ALTER FUNCTION public.sp_unavailable_overlaps(uuid, date, integer, integer) SET search_path TO 'public';