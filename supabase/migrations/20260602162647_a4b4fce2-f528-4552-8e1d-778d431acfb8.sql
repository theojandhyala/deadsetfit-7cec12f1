
-- Public stats column on profiles for FIFA-style card data shared with friends.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_stats jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Update public view to expose grit_points + public_stats so others can see your card.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
  SELECT id, username, display_name, avatar_url, bio, level, grit_points, public_stats
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
