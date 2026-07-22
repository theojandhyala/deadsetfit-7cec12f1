-- Persistent head-to-head duels: a tracked match between two athletes over a
-- window, scored live from each participant's logged sessions (no stored score).
-- Additive + idempotent — applied to the live DB via Lovable on 2026-07-22.
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  metric text not null default 'volume' check (metric in ('volume','sessions','prs')),
  status text not null default 'pending' check (status in ('pending','active','declined','cancelled','completed')),
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);
create index if not exists duels_challenger_idx on public.duels (challenger_id, status);
create index if not exists duels_opponent_idx on public.duels (opponent_id, status);

alter table public.duels enable row level security;
grant select, insert, update on public.duels to authenticated;
grant all on public.duels to service_role;

drop policy if exists "duel participants read" on public.duels;
create policy "duel participants read" on public.duels for select to authenticated
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);

drop policy if exists "challenger creates duel" on public.duels;
create policy "challenger creates duel" on public.duels for insert to authenticated
  with check (auth.uid() = challenger_id);

drop policy if exists "duel participants update" on public.duels;
create policy "duel participants update" on public.duels for update to authenticated
  using (auth.uid() = challenger_id or auth.uid() = opponent_id);
