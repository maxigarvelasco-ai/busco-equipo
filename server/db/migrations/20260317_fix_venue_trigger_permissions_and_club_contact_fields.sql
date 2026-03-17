begin;

-- Ensure clubs have explicit contact/location fields for feed cards.
alter table if exists public.clubs
  add column if not exists address text,
  add column if not exists phone text;

-- Replace legacy trigger function that queried auth.users (causes permission denied in some contexts).
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

  -- Read reviewer identity from JWT claims instead of auth.users table.
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

commit;
