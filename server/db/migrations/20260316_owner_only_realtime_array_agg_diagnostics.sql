-- Owner-only diagnostics for realtime functions that use array_agg
-- Requires function owner or superuser if you need to CREATE OR REPLACE extension-owned functions.

-- 1) List functions containing array_agg and owners.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  p.oid,
  substring(p.prosrc FROM 1 FOR 2000) AS source_preview
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc IS NOT NULL
  AND position('array_agg' IN p.prosrc) > 0
ORDER BY n.nspname, p.proname;

-- 2) If the failing function is in schema `realtime` and owner is not your role,
--    you must execute fixes with that owner role or open a Supabase support ticket.
--    Typical correction pattern inside PL/pgSQL:
--      invalid:  var = array_agg(x) from ...;
--      valid:    SELECT array_agg(x) INTO var FROM ...;

-- 3) Optional: capture full definitions before any owner-level changes.
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'realtime'
  AND p.proname IN ('apply_rls', 'subscription_check_filters');
