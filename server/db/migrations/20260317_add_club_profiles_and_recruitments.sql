begin;

-- 1) Add third profile type: club
alter table if exists public.profiles
  drop constraint if exists profiles_profile_type_check;
alter table if exists public.profiles
  add constraint profiles_profile_type_check check (profile_type in ('normal', 'venue_member', 'club'));

-- 2) Clubs catalog
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  city text,
  zone text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists clubs_creator_id_idx on public.clubs(creator_id);
create index if not exists clubs_created_at_idx on public.clubs(created_at desc);

-- 3) Club members
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint club_members_unique_member unique (club_id, user_id)
);

create index if not exists club_members_user_id_idx on public.club_members(user_id);

-- 4) Club recruitments (open player searches)
create table if not exists public.club_recruitments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  football_type int,
  category text,
  position_needed text,
  needed_players int not null default 1,
  city text,
  zone text,
  match_gender text,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint club_recruitments_needed_players_check check (needed_players > 0),
  constraint club_recruitments_football_type_check check (football_type in (5, 7, 11) or football_type is null),
  constraint club_recruitments_status_check check (status in ('open', 'closed'))
);

create index if not exists club_recruitments_club_id_idx on public.club_recruitments(club_id);
create index if not exists club_recruitments_status_created_idx on public.club_recruitments(status, created_at desc);

commit;
