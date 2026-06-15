CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_name text;
BEGIN
  profile_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'DEADSET Athlete'
  );

  BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, profile_name)
    ON CONFLICT (id) DO UPDATE
      SET display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
          updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile creation failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

INSERT INTO public.profiles (id, display_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'display_name', ''),
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'DEADSET Athlete'
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;