
-- Roles enum + table (separate from profiles to avoid privilege escalation)
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "users read own role"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Profiles
create type public.training_goal as enum ('BULK', 'CUT', 'MAINTAIN', 'ATHLETIC');
create type public.gender_type as enum ('MALE', 'FEMALE', 'OTHER');
create type public.equipment_type as enum ('FULL_GYM', 'HOME_GYM', 'DUMBBELLS_ONLY', 'BODYWEIGHT');
create type public.experience_level as enum ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  goal public.training_goal not null default 'MAINTAIN',
  gender public.gender_type not null default 'OTHER',
  age int not null default 25,
  height_cm numeric not null default 175,
  weight_kg numeric not null default 75,
  days_per_week int not null default 4,
  equipment public.equipment_type not null default 'FULL_GYM',
  experience public.experience_level not null default 'BEGINNER',
  dislikes text default '',
  active_program_id uuid,
  grit_points int not null default 0,
  level text not null default 'ROOKIE',
  workout_streak int not null default 0,
  diet_streak int not null default 0,
  checkin_streak int not null default 0,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "users read own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "users insert own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "users update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Exercises library
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,                  -- e.g. PUSH / PULL / LEGS / CORE / CARDIO
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text not null,                 -- BARBELL / DUMBBELL / CABLE / MACHINE / BODYWEIGHT / BANDS / KETTLEBELL
  difficulty int not null default 3 check (difficulty between 1 and 5),
  instructions text not null default '',
  pro_tip text not null default '',
  youtube_query text not null default '',
  warmup_note text not null default '',
  stretch_note text not null default '',
  is_compound boolean not null default false,
  created_at timestamptz not null default now()
);

grant select on public.exercises to authenticated, anon;
grant all on public.exercises to service_role;

create index exercises_category_idx on public.exercises (category);
create index exercises_equipment_idx on public.exercises (equipment);
create index exercises_primary_muscles_idx on public.exercises using gin (primary_muscles);

alter table public.exercises enable row level security;

create policy "anyone reads exercises"
on public.exercises for select
to authenticated, anon
using (true);

create policy "admins manage exercises"
on public.exercises for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
