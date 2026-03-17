-- Post-migration checks for:
-- 1) 20260317_add_club_profiles_and_recruitments.sql
-- 2) 20260317_role_requests_and_football_expansion.sql
-- 3) 20260317_birthdate_and_join_notification_cleanup.sql

-- A) Core tables exist
select
  to_regclass('public.clubs') as clubs_table,
  to_regclass('public.club_members') as club_members_table,
  to_regclass('public.club_recruitments') as club_recruitments_table,
  to_regclass('public.role_upgrade_requests') as role_upgrade_requests_table,
  to_regclass('public.notifications') as notifications_table,
  to_regclass('public.match_join_requests') as match_join_requests_table,
  to_regclass('public.profiles') as profiles_table;

-- B) Required columns exist
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in ('username', 'profile_type', 'birth_date', 'club_name', 'club_bio', 'club_city', 'club_zone', 'club_phone', 'club_contact_visible', 'venue_name', 'venue_bio', 'venue_city', 'venue_zone', 'venue_phone')) or
    (table_name = 'clubs' and column_name in ('id', 'creator_id', 'name', 'address', 'phone', 'city', 'zone', 'description', 'created_at')) or
    (table_name = 'club_recruitments' and column_name in ('club_id', 'football_type', 'status', 'created_at')) or
    (table_name = 'role_upgrade_requests' and column_name in ('user_id', 'desired_role', 'status', 'target_email', 'updated_at'))
  )
order by table_name, column_name;

-- C) Football-type constraints include F9
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in (
  'matches_football_type_check',
  'tournaments_football_type_check',
  'club_recruitments_football_type_check'
)
order by conname;

-- D) Profile type constraint includes club
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'profiles_profile_type_check';

-- E) Role-request constraints/indexes/triggers exist
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('role_upgrade_requests_role_check', 'role_upgrade_requests_status_check')
order by conname;

select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'role_upgrade_requests'
  and indexname in ('role_upgrade_requests_user_idx', 'role_upgrade_requests_unique_pending')
order by indexname;

select trigger_name, event_object_table
from information_schema.triggers
where event_object_schema = 'public'
  and (
    event_object_table = 'role_upgrade_requests' and trigger_name = 'trg_touch_role_upgrade_requests_updated_at'
    or
    event_object_table = 'venues' and trigger_name in ('trg_enforce_venue_member_insert', 'trg_enforce_venue_member_owner_update')
  )
order by event_object_table, trigger_name;

-- F) Function checks
select n.nspname as schema_name, p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'touch_role_upgrade_requests_updated_at',
    'enforce_venue_member_for_venues',
    'sync_profile_age_from_birth_date',
    'create_match_join_notification'
  )
order by p.proname;

-- G) Data sanity checks
-- G1) role_upgrade_requests values are valid
select
  count(*) as total_rows,
  count(*) filter (where desired_role not in ('venue_member', 'club') or desired_role is null) as invalid_desired_role,
  count(*) filter (where status not in ('pending', 'approved', 'rejected') or status is null) as invalid_status,
  count(*) filter (where target_email is null or target_email = '') as invalid_target_email
from public.role_upgrade_requests;

-- G2) club_recruitments status/football_type valid
select
  count(*) as total_rows,
  count(*) filter (where status not in ('open', 'closed') or status is null) as invalid_status,
  count(*) filter (where football_type is not null and football_type not in (5, 7, 9, 11)) as invalid_football_type
from public.club_recruitments;

-- G3) profiles birth_date check
select
  count(*) as total_profiles,
  count(*) filter (where birth_date is not null) as profiles_with_birth_date
from public.profiles;

-- H) Notification migration checks
-- H1) No legacy english message should remain
select count(*) as legacy_english_notifications
from public.notifications
where message = 'A player requested to join your match';

-- H2) Duplicate join-request notifications by request id (should be 0 ideally)
with grouped as (
  select
    coalesce(data ->> 'requestId', data ->> 'request_id') as request_id,
    user_id,
    count(*) as c
  from public.notifications
  where type in ('match_join_request', 'join_request_received')
    and coalesce(data ->> 'requestId', data ->> 'request_id') is not null
  group by 1,2
)
select count(*) as duplicate_groups
from grouped
where c > 1;

-- I) Quick smoke sample
select id, name, profile_type, birth_date
from public.profiles
order by created_at desc nulls last
limit 5;

select id, desired_role, status, target_email, created_at
from public.role_upgrade_requests
order by created_at desc
limit 10;

select id, club_id, football_type, status, created_at
from public.club_recruitments
order by created_at desc
limit 10;
