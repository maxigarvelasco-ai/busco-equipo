begin;

-- One-shot normalization for clubs + role access + football types.
-- Safe to run multiple times (idempotent).

-- 1) Profiles: ensure third type exists.
alter table if exists public.profiles
  drop constraint if exists profiles_profile_type_check;
alter table if exists public.profiles
  add constraint profiles_profile_type_check check (profile_type in ('normal', 'venue_member', 'club'));
alter table if exists public.profiles
  add column if not exists username text;
alter table if exists public.profiles
  add column if not exists club_name text,
  add column if not exists club_bio text,
  add column if not exists club_city text,
  add column if not exists club_zone text,
  add column if not exists club_phone text,
  add column if not exists club_contact_visible boolean not null default false,
  add column if not exists venue_name text,
  add column if not exists venue_bio text,
  add column if not exists venue_city text,
  add column if not exists venue_zone text,
  add column if not exists venue_phone text;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

-- 2) Matches/Tournaments football types: include F9.
alter table if exists public.matches
  drop constraint if exists matches_football_type_check;
alter table if exists public.matches
  add constraint matches_football_type_check check (football_type in (5, 7, 9, 11));

alter table if exists public.tournaments
  drop constraint if exists tournaments_football_type_check;
alter table if exists public.tournaments
  add constraint tournaments_football_type_check check (football_type in (5, 7, 9, 11));

-- 3) Clubs table normalization (works if table already existed with old schema).
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Mi club',
  address text,
  phone text,
  city text,
  zone text,
  description text,
  created_at timestamptz not null default now()
);

alter table if exists public.clubs
  add column if not exists creator_id uuid references auth.users(id) on delete cascade;
alter table if exists public.clubs
  add column if not exists address text;
alter table if exists public.clubs
  add column if not exists phone text;
alter table if exists public.clubs
  add column if not exists city text;
alter table if exists public.clubs
  add column if not exists zone text;
alter table if exists public.clubs
  add column if not exists description text;
alter table if exists public.clubs
  add column if not exists created_at timestamptz not null default now();

-- Compatibility with older schema that might have owner_id instead of creator_id.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'owner_id'
  ) then
    execute '
      update public.clubs
      set creator_id = owner_id
      where creator_id is null and owner_id is not null
    ';
  end if;
end $$;

create index if not exists clubs_creator_id_idx on public.clubs(creator_id);
create index if not exists clubs_created_at_idx on public.clubs(created_at desc);

-- 4) Club members.
create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint club_members_unique_member unique (club_id, user_id)
);

create index if not exists club_members_user_id_idx on public.club_members(user_id);

-- 5) Club recruitments.
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
  constraint club_recruitments_status_check check (status in ('open', 'closed'))
);

alter table if exists public.club_recruitments
  add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table if exists public.club_recruitments
  add column if not exists football_type int;
alter table if exists public.club_recruitments
  add column if not exists category text;
alter table if exists public.club_recruitments
  add column if not exists position_needed text;
alter table if exists public.club_recruitments
  add column if not exists needed_players int not null default 1;
alter table if exists public.club_recruitments
  add column if not exists city text;
alter table if exists public.club_recruitments
  add column if not exists zone text;
alter table if exists public.club_recruitments
  add column if not exists match_gender text;
alter table if exists public.club_recruitments
  add column if not exists description text;
alter table if exists public.club_recruitments
  add column if not exists status text;
alter table if exists public.club_recruitments
  add column if not exists created_at timestamptz not null default now();

update public.club_recruitments
set status = coalesce(nullif(status, ''), 'open')
where status is null;

alter table if exists public.club_recruitments
  alter column status set not null;

alter table if exists public.club_recruitments
  drop constraint if exists club_recruitments_needed_players_check;
alter table if exists public.club_recruitments
  add constraint club_recruitments_needed_players_check check (needed_players > 0);

alter table if exists public.club_recruitments
  drop constraint if exists club_recruitments_status_check;
alter table if exists public.club_recruitments
  add constraint club_recruitments_status_check check (status in ('open', 'closed'));

alter table if exists public.club_recruitments
  drop constraint if exists club_recruitments_football_type_check;
alter table if exists public.club_recruitments
  add constraint club_recruitments_football_type_check check (football_type in (5, 7, 9, 11) or football_type is null);

create index if not exists club_recruitments_club_id_idx on public.club_recruitments(club_id);
create index if not exists club_recruitments_status_created_idx on public.club_recruitments(status, created_at desc);

-- 6) Role upgrade requests table.
create table if not exists public.role_upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desired_role text not null,
  status text not null default 'pending',
  target_email text not null default 'Maximiliano.g.velasco@gmail.com',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_upgrade_requests_role_check check (desired_role in ('venue_member', 'club')),
  constraint role_upgrade_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

alter table if exists public.role_upgrade_requests
  add column if not exists desired_role text;
alter table if exists public.role_upgrade_requests
  add column if not exists status text;
alter table if exists public.role_upgrade_requests
  add column if not exists target_email text;
alter table if exists public.role_upgrade_requests
  add column if not exists message text;
alter table if exists public.role_upgrade_requests
  add column if not exists created_at timestamptz not null default now();
alter table if exists public.role_upgrade_requests
  add column if not exists updated_at timestamptz not null default now();

update public.role_upgrade_requests
set desired_role = coalesce(nullif(desired_role, ''), 'club')
where desired_role is null;

update public.role_upgrade_requests
set status = coalesce(nullif(status, ''), 'pending')
where status is null;

update public.role_upgrade_requests
set target_email = coalesce(nullif(target_email, ''), 'Maximiliano.g.velasco@gmail.com')
where target_email is null;

alter table if exists public.role_upgrade_requests
  alter column desired_role set not null;
alter table if exists public.role_upgrade_requests
  alter column status set not null;
alter table if exists public.role_upgrade_requests
  alter column target_email set not null;

alter table if exists public.role_upgrade_requests
  drop constraint if exists role_upgrade_requests_role_check;
alter table if exists public.role_upgrade_requests
  add constraint role_upgrade_requests_role_check check (desired_role in ('venue_member', 'club'));

alter table if exists public.role_upgrade_requests
  drop constraint if exists role_upgrade_requests_status_check;
alter table if exists public.role_upgrade_requests
  add constraint role_upgrade_requests_status_check check (status in ('pending', 'approved', 'rejected'));

create index if not exists role_upgrade_requests_user_idx
  on public.role_upgrade_requests(user_id, desired_role, status);

create unique index if not exists role_upgrade_requests_unique_pending
  on public.role_upgrade_requests(user_id, desired_role)
  where status = 'pending';

create or replace function public.touch_role_upgrade_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_role_upgrade_requests_updated_at on public.role_upgrade_requests;
create trigger trg_touch_role_upgrade_requests_updated_at
before update on public.role_upgrade_requests
for each row
execute function public.touch_role_upgrade_requests_updated_at();

-- 7) Compatibility patch for legacy venues guard trigger.
create or replace function public.enforce_venue_member_for_venues()
returns trigger
language plpgsql
as $$
declare
  v_has_approved boolean := false;
  v_is_reviewer boolean := false;
begin
  if new.owner_id is null then
    return new;
  end if;

  select exists(
    select 1
    from public.role_upgrade_requests r
    where r.user_id = new.owner_id
      and r.status = 'approved'
  ) into v_has_approved;

  -- Avoid direct reads from auth.users to prevent permission errors under RLS.
  -- Use JWT claims from the current session instead.
  v_is_reviewer := (
    auth.uid() = new.owner_id
    and lower(coalesce(auth.jwt() ->> 'email', '')) = 'maximiliano.g.velasco@gmail.com'
  );

  if not coalesce(v_has_approved, false) and not coalesce(v_is_reviewer, false) then
    raise exception 'account is not enabled for venue/club publishing';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_venue_member_insert on public.venues;
create trigger trg_enforce_venue_member_insert
before insert on public.venues
for each row
execute function public.enforce_venue_member_for_venues();

drop trigger if exists trg_enforce_venue_member_owner_update on public.venues;
create trigger trg_enforce_venue_member_owner_update
before update of owner_id on public.venues
for each row
execute function public.enforce_venue_member_for_venues();

commit;
