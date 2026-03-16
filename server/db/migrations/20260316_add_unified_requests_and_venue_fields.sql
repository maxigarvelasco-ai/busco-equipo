-- Unified requests and venue metadata for simplified product structure.

begin;

alter table if exists public.tournaments
  add column if not exists needed_players int,
  add column if not exists venue_name text;

update public.tournaments
set needed_players = 1
where needed_players is null;

alter table if exists public.tournaments
  alter column needed_players set default 1;

alter table if exists public.tournaments
  alter column needed_players set not null;

alter table if exists public.tournaments
  drop constraint if exists tournaments_needed_players_check;
alter table if exists public.tournaments
  add constraint tournaments_needed_players_check check (needed_players > 0 and needed_players <= 30);

alter table if exists public.venues
  add column if not exists city text,
  add column if not exists football_types text[] default '{}',
  add column if not exists services text[] default '{}';

create table if not exists public.tournament_player_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

alter table public.tournament_player_requests
  drop constraint if exists tournament_player_requests_status_check;
alter table public.tournament_player_requests
  add constraint tournament_player_requests_status_check check (status in ('pending', 'accepted', 'rejected'));

create index if not exists idx_tournament_player_requests_tournament on public.tournament_player_requests(tournament_id);
create index if not exists idx_tournament_player_requests_user on public.tournament_player_requests(user_id);

commit;
