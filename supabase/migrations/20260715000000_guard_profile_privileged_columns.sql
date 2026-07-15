-- Security fix: the "users update own profile" RLS policy has no column
-- restriction, so an authenticated user could write profiles.pro_until directly
-- via the public API and grant themselves free Pro (bypassing Stripe), or
-- rewrite referral ownership. Guard the monetization columns with a trigger:
-- only the service role (the server) may change them; direct authenticated
-- writes are silently reverted to their previous value.
--
-- Fail-safe: the guard fires ONLY for the 'authenticated' role. The service
-- role (Stripe sync, referral grants) and any direct DB/admin context pass
-- through unchanged, so legitimate Pro grants are never blocked.

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
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
before update on public.profiles
for each row
execute function public.guard_profile_privileged_columns();
