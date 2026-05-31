
CREATE OR REPLACE FUNCTION public.gen_ref_code() RETURNS text
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
$$;

REVOKE EXECUTE ON FUNCTION public.gen_ref_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_ref_code() TO service_role;
