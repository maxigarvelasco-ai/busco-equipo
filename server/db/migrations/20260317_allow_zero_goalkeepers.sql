begin;

alter table if exists public.matches
  alter column goalkeepers_needed set default 0;

alter table if exists public.matches
  drop constraint if exists matches_goalkeepers_needed_check;
alter table if exists public.matches
  add constraint matches_goalkeepers_needed_check check (goalkeepers_needed in (0, 1, 2));

update public.matches
set goalkeepers_needed = 0
where goalkeepers_needed is null;

commit;
