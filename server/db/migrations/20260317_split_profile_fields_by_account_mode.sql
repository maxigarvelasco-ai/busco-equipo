begin;

-- Keep personal profile fields independent from club/venue identity fields.
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

commit;
