
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS bio text DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pro_until timestamptz;

-- Default referral_code generator
CREATE OR REPLACE FUNCTION public.gen_ref_code() RETURNS text
LANGUAGE sql AS $$
  SELECT upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
$$;

UPDATE public.profiles SET referral_code = public.gen_ref_code() WHERE referral_code IS NULL;

-- Allow public read of limited profile columns for the leaderboard via security definer view (simpler: policy allow read for authenticated)
DROP POLICY IF EXISTS "authenticated read public profile fields" ON public.profiles;
CREATE POLICY "authenticated read public profile fields"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- 2. Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('workout','pr','progress','text')),
  content text NOT NULL DEFAULT '',
  image_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_created_idx ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS posts_user_idx ON public.posts (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "users like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unlike own" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read comments" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "users comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own comments" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read follows" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "users follow" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "users unfollow" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- 6. Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, referred_id)
);
GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
