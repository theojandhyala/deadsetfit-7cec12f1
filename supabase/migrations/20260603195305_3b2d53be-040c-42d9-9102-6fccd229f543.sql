DO $$
DECLARE
  uid uuid := '5b508825-aa24-47a1-ad6c-5171cd5d9e85';
BEGIN
  DELETE FROM public.post_likes WHERE user_id = uid;
  DELETE FROM public.post_comments WHERE user_id = uid;
  DELETE FROM public.posts WHERE user_id = uid;
  DELETE FROM public.follows WHERE follower_id = uid OR following_id = uid;
  DELETE FROM public.user_blocks WHERE blocker_id = uid OR blocked_id = uid;
  DELETE FROM public.user_reports WHERE reporter_id = uid OR reported_user_id = uid;
  DELETE FROM public.user_roles WHERE user_id = uid;
  DELETE FROM public.user_state WHERE user_id = uid;
  DELETE FROM public.referrals WHERE referrer_id = uid OR referred_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END $$;