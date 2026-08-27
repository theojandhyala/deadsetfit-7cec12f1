-- A Stripe trial or failed collection is not paid Pro. Keep the SQL gate in
-- lockstep with src/lib/entitlements.ts and api/rpc.ts.
create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      status = 'active'
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

revoke execute on function public.has_active_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.has_active_subscription(uuid, text) to service_role;
