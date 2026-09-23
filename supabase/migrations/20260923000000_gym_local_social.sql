-- Opt-in, city-level gym community. Exact coordinates are never stored.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_name text,
  ADD COLUMN IF NOT EXISTS gym_key text,
  ADD COLUMN IF NOT EXISTS gym_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_gym_community_idx
  ON public.profiles (lower(country), lower(city), gym_key)
  WHERE gym_key IS NOT NULL;

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  bio,
  level,
  grit_points,
  public_stats,
  city,
  region,
  country,
  gym_name,
  gym_key
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
