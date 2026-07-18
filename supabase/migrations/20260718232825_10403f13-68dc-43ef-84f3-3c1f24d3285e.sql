create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    new.pro_until := old.pro_until;
    new.referred_by := old.referred_by;
    new.referral_code := old.referral_code;
    new.grit_points := old.grit_points;
    new.public_stats := old.public_stats;
  end if;
  return new;
end;
$$;