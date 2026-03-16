-- Switch match segmentation from level to match kind.
-- Adds match_kind without destructive changes.

begin;

alter table if exists public.matches
  add column if not exists match_kind text;

update public.matches
set match_kind = case
  when coalesce(level_required, 0) >= 7 then 'competitivo'
  when coalesce(level_required, 0) between 1 and 6 then 'recreativo'
  else 'recreativo'
end
where match_kind is null;

alter table if exists public.matches
  alter column match_kind set default 'recreativo';

update public.matches
set match_kind = 'recreativo'
where match_kind is null;

alter table if exists public.matches
  alter column match_kind set not null;

alter table if exists public.matches
  drop constraint if exists matches_match_kind_check;
alter table if exists public.matches
  add constraint matches_match_kind_check check (match_kind in ('recreativo', 'competitivo', 'torneo'));

create index if not exists idx_matches_match_kind on public.matches(match_kind);

commit;
