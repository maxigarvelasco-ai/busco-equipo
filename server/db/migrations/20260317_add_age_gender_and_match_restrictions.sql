begin;

alter table if exists public.profiles
  add column if not exists age int,
  add column if not exists gender text;

alter table if exists public.profiles
  drop constraint if exists profiles_age_check;
alter table if exists public.profiles
  add constraint profiles_age_check check (age between 13 and 90 or age is null);

alter table if exists public.profiles
  drop constraint if exists profiles_gender_check;
alter table if exists public.profiles
  add constraint profiles_gender_check check (gender in ('masculino', 'femenino') or gender is null);

alter table if exists public.matches
  add column if not exists match_gender text not null default 'mixto',
  add column if not exists age_restricted boolean not null default false,
  add column if not exists min_age int,
  add column if not exists max_age int,
  add column if not exists goalkeepers_needed int not null default 1;

alter table if exists public.matches
  drop constraint if exists matches_match_gender_check;
alter table if exists public.matches
  add constraint matches_match_gender_check check (match_gender in ('masculino', 'femenino', 'mixto'));

alter table if exists public.matches
  drop constraint if exists matches_goalkeepers_needed_check;
alter table if exists public.matches
  add constraint matches_goalkeepers_needed_check check (goalkeepers_needed in (1, 2));

alter table if exists public.matches
  drop constraint if exists matches_age_range_check;
alter table if exists public.matches
  add constraint matches_age_range_check check (
    (age_restricted = false and min_age is null and max_age is null)
    or
    (age_restricted = true and min_age is not null and max_age is not null and min_age <= max_age and min_age >= 13 and max_age <= 90)
  );

alter table if exists public.tournaments
  add column if not exists match_gender text not null default 'mixto',
  add column if not exists age_restricted boolean not null default false,
  add column if not exists min_age int,
  add column if not exists max_age int;

alter table if exists public.tournaments
  drop constraint if exists tournaments_match_gender_check;
alter table if exists public.tournaments
  add constraint tournaments_match_gender_check check (match_gender in ('masculino', 'femenino', 'mixto'));

alter table if exists public.tournaments
  drop constraint if exists tournaments_age_range_check;
alter table if exists public.tournaments
  add constraint tournaments_age_range_check check (
    (age_restricted = false and min_age is null and max_age is null)
    or
    (age_restricted = true and min_age is not null and max_age is not null and min_age <= max_age and min_age >= 13 and max_age <= 90)
  );

create index if not exists idx_matches_match_gender on public.matches(match_gender);
create index if not exists idx_tournaments_match_gender on public.tournaments(match_gender);

commit;
