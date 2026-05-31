-- Restrict profiles SELECT to owner only; expose limited public fields via a view.
DROP POLICY IF EXISTS "authenticated read public profile fields" ON public.profiles;

-- Public-facing view exposes only safe identity fields for cross-user reads
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, username, display_name, avatar_url, bio, level
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Lock down SECURITY DEFINER helpers so signed-in users cannot call them directly.
-- has_role is invoked from within RLS policies (definer chain), so revoking EXECUTE
-- from PUBLIC/authenticated still allows policy evaluation.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_ref_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Explicit deny for user_roles writes by regular users (defense-in-depth; no policies = denied by default,
-- but make intent explicit so future permissive policies don't accidentally open this up).
-- No INSERT/UPDATE/DELETE policies are added — only admins via service_role or SECURITY DEFINER functions
-- with strict validation may modify roles.
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated, anon;