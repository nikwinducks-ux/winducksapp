-- Lock down execute on the new SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.next_customer_invoice_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.convert_job_to_invoice(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_customer_invoice_sent(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tg_validate_customer_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_validate_job_status() FROM PUBLIC, anon, authenticated;

-- Admin-callable RPCs
GRANT EXECUTE ON FUNCTION public.convert_job_to_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_invoice_sent(uuid, text) TO authenticated;

-- Public token-based read remains callable by anon (intentional; checks token internally)
GRANT EXECUTE ON FUNCTION public.get_customer_invoice_by_token(text) TO anon, authenticated;
