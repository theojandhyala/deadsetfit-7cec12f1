ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_city_idx ON public.profiles (lower(country), lower(city)) WHERE city IS NOT NULL;

-- Recreate public_profiles view with city/country exposed (safe to share — city only, no coords).
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
  country
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;