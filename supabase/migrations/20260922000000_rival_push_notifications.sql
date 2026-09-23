-- APNs device registration and server-enforced rival notification preferences.
-- Tokens are never readable by clients. Every write goes through the
-- authenticated DEADSET API using the service role.
create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios')),
  rival_alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant all on public.device_tokens to service_role;

create table if not exists public.rival_push_log (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  sent_at timestamptz not null default now(),
  unique (duel_id, recipient_id, session_id)
);

create index if not exists rival_push_log_rate_idx
  on public.rival_push_log (duel_id, recipient_id, sent_at desc);

alter table public.rival_push_log enable row level security;
revoke all on public.rival_push_log from anon, authenticated;
grant all on public.rival_push_log to service_role;
