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