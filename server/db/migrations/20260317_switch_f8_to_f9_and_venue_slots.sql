begin;

-- Normalize football type F8 -> F9.
update public.matches set football_type = 9 where football_type = 8;
update public.tournaments set football_type = 9 where football_type = 8;
update public.club_recruitments set football_type = 9 where football_type = 8;

alter table if exists public.matches
  drop constraint if exists matches_football_type_check;
alter table if exists public.matches
  add constraint matches_football_type_check check (football_type in (5, 7, 9, 11));

alter table if exists public.tournaments
  drop constraint if exists tournaments_football_type_check;
alter table if exists public.tournaments
  add constraint tournaments_football_type_check check (football_type in (5, 7, 9, 11));

alter table if exists public.club_recruitments
  drop constraint if exists club_recruitments_football_type_check;
alter table if exists public.club_recruitments
  add constraint club_recruitments_football_type_check check (football_type in (5, 7, 9, 11) or football_type is null);

-- Optional contact visibility in club cards.
alter table if exists public.profiles
  add column if not exists club_contact_visible boolean not null default false;

-- Venue details and slot booking basics.
alter table if exists public.venues
  add column if not exists description text;

create table if not exists public.venue_slots (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  slot_time text not null,
  price numeric(10,2) not null default 0,
  status text not null default 'available',
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint venue_slots_status_check check (status in ('available', 'booked')),
  constraint venue_slots_unique_per_venue unique (venue_id, slot_time)
);

create index if not exists venue_slots_venue_idx on public.venue_slots(venue_id);

commit;
