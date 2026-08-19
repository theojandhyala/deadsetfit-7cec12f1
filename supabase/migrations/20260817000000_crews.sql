-- Crews: the gym/team an athlete trains with. A crew is joined with a short
-- code, ranks its own members, and competes with other crews.
--
-- One crew per athlete (unique index on crew_members.user_id): a lifter who
-- belongs to three crews makes every crew leaderboard meaningless, and the
-- product promise is "my gym versus yours".
--
-- Additive + idempotent, matching the duels migration.
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 30),
  -- Short display tag, shown next to a member's name on leaderboards.
  tag text not null check (tag ~ '^[A-Z0-9]{2,6}$'),
  -- Shared to invite: unambiguous characters only, so a code read aloud in a
  -- gym cannot be heard as O/0 or I/1.
  invite_code text not null check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists crews_invite_code_key on public.crews (upper(invite_code));
create unique index if not exists crews_tag_key on public.crews (upper(tag));

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

-- One crew per athlete.
create unique index if not exists crew_members_one_per_user on public.crew_members (user_id);
create index if not exists crew_members_crew_idx on public.crew_members (crew_id);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;

grant select, insert, update, delete on public.crews to authenticated;
grant select, insert, delete on public.crew_members to authenticated;
grant all on public.crews to service_role;
grant all on public.crew_members to service_role;

-- Crews are public: the global crew ladder and joining by code both need to
-- read a crew the athlete is not in yet.
drop policy if exists "crews readable" on public.crews;
create policy "crews readable" on public.crews for select to authenticated using (true);

drop policy if exists "owner creates crew" on public.crews;
create policy "owner creates crew" on public.crews for insert to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "owner updates crew" on public.crews;
create policy "owner updates crew" on public.crews for update to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "owner deletes crew" on public.crews;
create policy "owner deletes crew" on public.crews for delete to authenticated
  using (auth.uid() = owner_id);

-- Rosters are readable so a crew page can list who is in it.
drop policy if exists "crew members readable" on public.crew_members;
create policy "crew members readable" on public.crew_members for select to authenticated
  using (true);

drop policy if exists "athlete joins for self" on public.crew_members;
create policy "athlete joins for self" on public.crew_members for insert to authenticated
  with check (auth.uid() = user_id);

-- An athlete can leave; an owner can remove someone from their own crew.
drop policy if exists "athlete leaves or owner removes" on public.crew_members;
create policy "athlete leaves or owner removes" on public.crew_members for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.crews c
      where c.id = crew_members.crew_id and c.owner_id = auth.uid()
    )
  );

-- A crew name and tag are user-authored and shown on the public ladder, so a
-- crew has to be reportable exactly like a post or a profile. Without this the
-- app would ship a user-generated surface with no report path, which is what
-- App Review Guideline 1.2 asks for.
alter table public.user_reports
  add column if not exists reported_crew_id uuid references public.crews(id) on delete cascade;

create index if not exists user_reports_crew_idx on public.user_reports (reported_crew_id);
