-- Verification script for 20260316_harden_match_delete_and_realtime_notifications.sql
-- Run in Supabase SQL editor with "No limit".

-- 1) Verify updated functions exist.
SELECT pg_get_functiondef('public.delete_match(uuid)'::regprocedure);
SELECT pg_get_functiondef('public.request_join_match(uuid,uuid)'::regprocedure);
SELECT pg_get_functiondef('public.create_chat_notifications()'::regprocedure);
SELECT pg_get_functiondef('public.create_match_join_notification()'::regprocedure);

-- 2) Verify triggers on source tables.
SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('match_messages', 'match_join_requests')
ORDER BY event_object_table, trigger_name;

-- 3) Verify no duplicate notifications by messageId/requestId.
SELECT user_id, type, data->>'messageId' AS message_id, COUNT(*)
FROM public.notifications
WHERE type = 'new_chat_message' AND data ? 'messageId'
GROUP BY user_id, type, data->>'messageId'
HAVING COUNT(*) > 1;

SELECT user_id, type, data->>'requestId' AS request_id, COUNT(*)
FROM public.notifications
WHERE type = 'match_join_request' AND data ? 'requestId'
GROUP BY user_id, type, data->>'requestId'
HAVING COUNT(*) > 1;

-- 4) Manual E2E test data (replace placeholders):
--    a) Insert a chat message as any participant to trigger notifications.
-- INSERT INTO public.match_messages (match_id, user_id, message)
-- VALUES ('<match_uuid>', '<sender_uuid>', 'mensaje de prueba realtime');

--    b) Check generated notifications for that message.
-- SELECT id, user_id, type, message, data, created_at
-- FROM public.notifications
-- WHERE data->>'matchId' = '<match_uuid>'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- 5) Manual delete_match test:
-- SELECT public.delete_match('<match_uuid>'::uuid);
-- Expected: {"ok": true, "matchId": "..."}
