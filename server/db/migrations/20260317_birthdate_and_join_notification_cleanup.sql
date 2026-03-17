begin;

-- 1) Profiles: store birth date and keep age synced for compatibility.
alter table if exists public.profiles
  add column if not exists birth_date date;

create or replace function public.sync_profile_age_from_birth_date()
returns trigger
language plpgsql
as $$
begin
  if new.birth_date is not null then
    new.age := extract(year from age(current_date, new.birth_date))::int;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_age_from_birth_date on public.profiles;
create trigger trg_sync_profile_age_from_birth_date
before insert or update of birth_date
on public.profiles
for each row
execute function public.sync_profile_age_from_birth_date();

-- Backfill birth_date for existing rows with age (approximation at July 1st).
update public.profiles
set birth_date = make_date(extract(year from current_date)::int - age, 7, 1)
where birth_date is null
  and age is not null
  and age between 13 and 90;

-- 2) Join request notification: single Spanish message with requester + match.
create or replace function public.create_match_join_notification()
returns trigger
language plpgsql
as $$
declare
  v_creator uuid;
  v_requester_name text;
  v_match_label text;
begin
  select m.creator_id,
         coalesce(nullif(m.title, ''), 'partido F' || m.football_type::text || case when coalesce(m.address, m.zone, '') <> '' then ' en ' || coalesce(m.address, m.zone) else '' end)
    into v_creator, v_match_label
  from public.matches m
  where m.id = new.match_id;

  if v_creator is null or v_creator = new.user_id then
    return new;
  end if;

  select coalesce(p.name, 'usuario') into v_requester_name
  from public.profiles p
  where p.id = new.user_id;

  insert into public.notifications (user_id, type, message, data)
  values (
    v_creator,
    'match_join_request',
    'Tenes una nueva solicitud de ' || coalesce(v_requester_name, 'usuario') || ' para unirse al ' || coalesce(v_match_label, 'partido'),
    jsonb_build_object(
      'requestId', new.id,
      'matchId', new.match_id,
      'userId', new.user_id,
      'path', concat('/match/', new.match_id)
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trigger_match_join_notification on public.match_join_requests;
create trigger trigger_match_join_notification
after insert on public.match_join_requests
for each row
execute function public.create_match_join_notification();

-- 3) Clean existing duplicate/english join-request notifications.
with ranked as (
  select
    n.id,
    row_number() over (
      partition by n.user_id, n.type, coalesce(n.data ->> 'requestId', n.data ->> 'request_id')
      order by
        case when n.message ilike 'Tenes una nueva solicitud de %' then 0 else 1 end,
        n.created_at desc,
        n.id desc
    ) as rn
  from public.notifications n
  where n.type in ('match_join_request', 'join_request_received')
    and coalesce(n.data ->> 'requestId', n.data ->> 'request_id') is not null
)
delete from public.notifications n
using ranked r
where n.id = r.id
  and r.rn > 1;

-- Remove legacy english text rows if they still exist.
delete from public.notifications
where message = 'A player requested to join your match';

-- Rewrite remaining generic spanish rows with requester + match label.
update public.notifications n
set message = 'Tenes una nueva solicitud de ' || coalesce(p.name, 'usuario') || ' para unirse al ' ||
              coalesce(nullif(m.title, ''), 'partido F' || m.football_type::text || case when coalesce(m.address, m.zone, '') <> '' then ' en ' || coalesce(m.address, m.zone) else '' end)
from public.match_join_requests r
join public.matches m on m.id = r.match_id
left join public.profiles p on p.id = r.user_id
where n.type in ('match_join_request', 'join_request_received')
  and coalesce(n.data ->> 'requestId', n.data ->> 'request_id') = r.id::text
  and (n.message is null or n.message not ilike 'Tenes una nueva solicitud de %');

commit;
