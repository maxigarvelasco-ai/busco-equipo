begin;

-- 1) Allow extra football type (F8) in core entities
alter table if exists public.matches
  drop constraint if exists matches_football_type_check;
alter table if exists public.matches
  add constraint matches_football_type_check check (football_type in (5, 7, 8, 11));

alter table if exists public.tournaments
  drop constraint if exists tournaments_football_type_check;
alter table if exists public.tournaments
  add constraint tournaments_football_type_check check (football_type in (5, 7, 8, 11));

alter table if exists public.club_recruitments
  add column if not exists football_type int;

alter table if exists public.club_recruitments
  drop constraint if exists club_recruitments_football_type_check;
alter table if exists public.club_recruitments
  add constraint club_recruitments_football_type_check check (football_type in (5, 7, 8, 11) or football_type is null);

-- 2) Requests for privileged role access (venue owner / club)
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

-- 3) Compatibility patch for legacy venues guard trigger.
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

  select lower(coalesce(u.email, '')) = 'maximiliano.g.velasco@gmail.com'
    into v_is_reviewer
  from auth.users u
  where u.id = new.owner_id;

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
