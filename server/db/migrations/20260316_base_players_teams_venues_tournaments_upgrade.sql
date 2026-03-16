-- Base upgrade for players, teams, venues, and tournaments.
-- Safe to run on existing environments (additive changes only).

begin;

-- =========================
-- PROFILES: player metadata
-- =========================
alter table if exists public.profiles
  add column if not exists nickname text,
  add column if not exists city text,
  add column if not exists zone text,
  add column if not exists preferred_foot text,
  add column if not exists preferred_position text,
  add column if not exists skill_level int,
  add column if not exists birth_date date,
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists is_profile_public boolean not null default true,
  add column if not exists search_vector tsvector;

alter table if exists public.profiles
  drop constraint if exists profiles_preferred_foot_check;
alter table if exists public.profiles
  add constraint profiles_preferred_foot_check check (preferred_foot in ('left', 'right', 'both') or preferred_foot is null);

alter table if exists public.profiles
  drop constraint if exists profiles_skill_level_check;
alter table if exists public.profiles
  add constraint profiles_skill_level_check check (skill_level between 1 and 10 or skill_level is null);

create index if not exists idx_profiles_city on public.profiles(city);
create index if not exists idx_profiles_zone on public.profiles(zone);
create index if not exists idx_profiles_skill_level on public.profiles(skill_level);

create or replace function public.refresh_profiles_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.nickname, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.zone, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.preferred_position, '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_profiles_search_vector on public.profiles;
create trigger trg_profiles_search_vector
before insert or update of name, nickname, city, zone, preferred_position
on public.profiles
for each row
execute function public.refresh_profiles_search_vector();

update public.profiles
set search_vector =
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(nickname, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(city, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(zone, '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(preferred_position, '')), 'D')
where search_vector is null;

create index if not exists idx_profiles_search_vector on public.profiles using gin(search_vector);

-- ==================================
-- MATCHES: richer public match model
-- ==================================
alter table if exists public.matches
  add column if not exists title text,
  add column if not exists level_required int,
  add column if not exists is_private boolean not null default false,
  add column if not exists visibility text not null default 'public',
  add column if not exists allow_waitlist boolean not null default true,
  add column if not exists requires_approval boolean not null default true,
  add column if not exists price_per_player numeric(10,2) not null default 0,
  add column if not exists status text not null default 'open',
  add column if not exists canceled_reason text;

alter table if exists public.matches
  drop constraint if exists matches_visibility_check;
alter table if exists public.matches
  add constraint matches_visibility_check check (visibility in ('public', 'contacts_only', 'private'));

alter table if exists public.matches
  drop constraint if exists matches_status_check;
alter table if exists public.matches
  add constraint matches_status_check check (status in ('open', 'closed', 'full', 'canceled', 'finished'));

alter table if exists public.matches
  drop constraint if exists matches_level_required_check;
alter table if exists public.matches
  add constraint matches_level_required_check check (level_required between 1 and 10 or level_required is null);

create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_visibility on public.matches(visibility);
create index if not exists idx_matches_level_required on public.matches(level_required);

-- ==================================
-- Match attendance and ratings
-- ==================================
create table if not exists public.match_attendance_confirmations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  status text not null default 'confirmed',
  unique (match_id, user_id)
);

alter table public.match_attendance_confirmations
  drop constraint if exists match_attendance_confirmations_status_check;
alter table public.match_attendance_confirmations
  add constraint match_attendance_confirmations_status_check
  check (status in ('confirmed', 'declined', 'late_cancel'));

create index if not exists idx_attendance_match on public.match_attendance_confirmations(match_id);
create index if not exists idx_attendance_user on public.match_attendance_confirmations(user_id);

create table if not exists public.player_reviews (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewed_user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (match_id, reviewer_id, reviewed_user_id)
);

alter table public.player_reviews
  drop constraint if exists player_reviews_rating_check;
alter table public.player_reviews
  add constraint player_reviews_rating_check check (rating between 1 and 5);

create index if not exists idx_player_reviews_reviewed_user on public.player_reviews(reviewed_user_id);

-- ==================================
-- Teams: persistent teams + requests
-- ==================================
create table if not exists public.user_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  zone text,
  football_type int,
  level int,
  description text,
  logo_url text,
  captain_id uuid not null references auth.users(id) on delete restrict,
  is_public boolean not null default true,
  is_recruiting boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_teams
  drop constraint if exists user_teams_football_type_check;
alter table public.user_teams
  add constraint user_teams_football_type_check
  check (football_type in (5, 7, 11) or football_type is null);

alter table public.user_teams
  drop constraint if exists user_teams_level_check;
alter table public.user_teams
  add constraint user_teams_level_check
  check (level between 1 and 10 or level is null);

create index if not exists idx_user_teams_zone on public.user_teams(zone);
create index if not exists idx_user_teams_recruiting on public.user_teams(is_recruiting);

create table if not exists public.user_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.user_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

alter table public.user_team_members
  drop constraint if exists user_team_members_role_check;
alter table public.user_team_members
  add constraint user_team_members_role_check
  check (role in ('captain', 'co_captain', 'player'));

alter table public.user_team_members
  drop constraint if exists user_team_members_status_check;
alter table public.user_team_members
  add constraint user_team_members_status_check
  check (status in ('active', 'inactive'));

create index if not exists idx_user_team_members_user on public.user_team_members(user_id);

create table if not exists public.user_team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.user_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (team_id, user_id, status)
);

alter table public.user_team_join_requests
  drop constraint if exists user_team_join_requests_status_check;
alter table public.user_team_join_requests
  add constraint user_team_join_requests_status_check
  check (status in ('pending', 'accepted', 'rejected', 'withdrawn'));

create index if not exists idx_team_requests_team on public.user_team_join_requests(team_id);
create index if not exists idx_team_requests_user on public.user_team_join_requests(user_id);

-- ==================================
-- Venues / tournaments enrichments
-- ==================================
alter table if exists public.venues
  add column if not exists amenities text[] default '{}',
  add column if not exists cover_image_url text,
  add column if not exists whatsapp text,
  add column if not exists rating numeric(3,2),
  add column if not exists is_verified boolean not null default false;

alter table if exists public.venues
  drop constraint if exists venues_rating_check;
alter table if exists public.venues
  add constraint venues_rating_check check (rating between 0 and 5 or rating is null);

create index if not exists idx_venues_verified on public.venues(is_verified);

alter table if exists public.tournaments
  add column if not exists zone text,
  add column if not exists city text,
  add column if not exists visibility text not null default 'public',
  add column if not exists format text,
  add column if not exists prize text,
  add column if not exists rules text,
  add column if not exists registration_deadline date;

alter table if exists public.tournaments
  drop constraint if exists tournaments_visibility_check;
alter table if exists public.tournaments
  add constraint tournaments_visibility_check check (visibility in ('public', 'private'));

create index if not exists idx_tournaments_zone on public.tournaments(zone);

-- ==================================
-- RPC helpers used by client
-- ==================================
create or replace function public.confirm_match_attendance(
  p_match_id uuid,
  p_user_id uuid,
  p_status text default 'confirmed'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_exists boolean;
begin
  if p_status not in ('confirmed', 'declined', 'late_cancel') then
    raise exception 'invalid attendance status';
  end if;

  select exists (
    select 1 from public.match_players mp
    where mp.match_id = p_match_id and mp.user_id = p_user_id
  ) into v_player_exists;

  if not v_player_exists then
    return jsonb_build_object('ok', false, 'reason', 'not_player');
  end if;

  insert into public.match_attendance_confirmations(match_id, user_id, status)
  values (p_match_id, p_user_id, p_status)
  on conflict (match_id, user_id)
  do update set status = excluded.status, confirmed_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.confirm_match_attendance(uuid, uuid, text) to authenticated;

create or replace function public.review_player_after_match(
  p_match_id uuid,
  p_reviewer_id uuid,
  p_reviewed_user_id uuid,
  p_rating int,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_is_player boolean;
  v_reviewed_is_player boolean;
begin
  if p_reviewer_id = p_reviewed_user_id then
    return jsonb_build_object('ok', false, 'reason', 'self_review_not_allowed');
  end if;

  if p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_rating');
  end if;

  select exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = p_reviewer_id
  ) into v_reviewer_is_player;

  select exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = p_reviewed_user_id
  ) into v_reviewed_is_player;

  if not v_reviewer_is_player or not v_reviewed_is_player then
    return jsonb_build_object('ok', false, 'reason', 'both_must_be_players');
  end if;

  insert into public.player_reviews(match_id, reviewer_id, reviewed_user_id, rating, comment)
  values (p_match_id, p_reviewer_id, p_reviewed_user_id, p_rating, p_comment)
  on conflict (match_id, reviewer_id, reviewed_user_id)
  do update set rating = excluded.rating, comment = excluded.comment, created_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.review_player_after_match(uuid, uuid, uuid, int, text) to authenticated;

commit;
