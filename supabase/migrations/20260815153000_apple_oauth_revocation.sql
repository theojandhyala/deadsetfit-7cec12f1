create table if not exists public.oauth_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple')),
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.oauth_credentials enable row level security;
revoke all on table public.oauth_credentials from public, anon, authenticated;

comment on table public.oauth_credentials is
  'Service-role-only provider credentials retained solely for account-deletion revocation.';
