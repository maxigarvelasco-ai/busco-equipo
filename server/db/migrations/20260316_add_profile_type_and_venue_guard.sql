-- Add profile classes and enforce venue creation permissions.

begin;

alter table if exists public.profiles
  add column if not exists profile_type text not null default 'normal';

alter table if exists public.profiles
  drop constraint if exists profiles_profile_type_check;
alter table if exists public.profiles
  add constraint profiles_profile_type_check check (profile_type in ('normal', 'venue_member'));

create or replace function public.enforce_venue_member_for_venues()
returns trigger
language plpgsql
as $$
declare
  v_profile_type text;
begin
  if new.owner_id is null then
    return new;
  end if;

  select p.profile_type
    into v_profile_type
  from public.profiles p
  where p.id = new.owner_id;

  if coalesce(v_profile_type, 'normal') <> 'venue_member' then
    raise exception 'only venue_member profiles can create venues';
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
