begin;

alter table if exists public.profiles
  add column if not exists username text;

-- Backfill missing usernames using normalized name and deterministic suffixes.
with prepared as (
  select
    p.id,
    coalesce(nullif(p.username, ''), nullif(p.nickname, ''), nullif(p.name, ''), 'jugador') as raw_base
  from public.profiles p
), normalized as (
  select
    id,
    case
      when trim(both '_' from lower(regexp_replace(raw_base, '[^a-zA-Z0-9_]+', '_', 'g'))) = '' then 'jugador'
      else trim(both '_' from lower(regexp_replace(raw_base, '[^a-zA-Z0-9_]+', '_', 'g')))
    end as base
  from prepared
), ranked as (
  select
    id,
    left(base, 24) as base,
    row_number() over (partition by base order by id) as rn
  from normalized
)
update public.profiles p
set username = case
  when r.rn = 1 then r.base
  else left(r.base, 20) || '_' || r.rn::text
end
from ranked r
where p.id = r.id
  and coalesce(p.username, '') = '';

create or replace function public.ensure_unique_profile_username()
returns trigger
language plpgsql
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 1;
begin
  v_base := lower(regexp_replace(coalesce(nullif(new.username, ''), nullif(new.nickname, ''), nullif(new.name, ''), 'jugador'), '[^a-zA-Z0-9_]+', '_', 'g'));
  v_base := trim(both '_' from v_base);
  if coalesce(v_base, '') = '' then
    v_base := 'jugador';
  end if;
  v_base := left(v_base, 24);
  v_candidate := v_base;

  while exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(v_candidate)
      and p.id <> new.id
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate := left(v_base, 20) || '_' || v_suffix::text;
  end loop;

  new.username := v_candidate;
  return new;
end;
$$;

drop trigger if exists trg_ensure_unique_profile_username on public.profiles;
create trigger trg_ensure_unique_profile_username
before insert or update of username, nickname, name on public.profiles
for each row
execute function public.ensure_unique_profile_username();

-- Run trigger logic for existing rows in case any duplicates remain.
update public.profiles
set username = username;

alter table if exists public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username));

commit;
