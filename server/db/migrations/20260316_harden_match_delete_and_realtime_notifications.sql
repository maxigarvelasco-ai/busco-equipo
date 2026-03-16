-- Migration: Harden match deletion, join-request dedupe, and realtime chat notifications
--
-- What this migration does:
-- 1) Creates a secure delete RPC: public.delete_match(p_match_id uuid)
--    - only the match creator can delete
--    - deletes dependent rows in one transaction
-- 2) Normalizes and deduplicates join-request notifications
-- 3) Recreates chat notification trigger to avoid duplicates and notify all recipients except sender
-- 4) Adds defensive unique indexes for notification dedupe keys
--
-- Backup helpers (run before applying if you want backups):
-- SELECT pg_get_functiondef('public.delete_match(uuid)'::regprocedure);
-- SELECT pg_get_functiondef('public.request_join_match(uuid,uuid)'::regprocedure);
-- SELECT pg_get_functiondef('public.create_match_join_notification()'::regprocedure);
-- SELECT pg_get_functiondef('public.create_chat_notifications()'::regprocedure);

-- --- 1) Delete-match RPC (single-arg, auth.uid based) ---
DROP FUNCTION IF EXISTS public.delete_match(integer, integer);

CREATE OR REPLACE FUNCTION public.delete_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid := auth.uid();
  v_creator uuid;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para eliminar un partido';
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_creator IS DISTINCT FROM v_requester THEN
    RAISE EXCEPTION 'No autorizado: solo el creador puede eliminar el partido';
  END IF;

  -- Delete notifications tied to this match/messages/requests.
  DELETE FROM public.notifications n
  WHERE (n.data ->> 'matchId') = p_match_id::text
     OR (n.data ->> 'path') = CONCAT('/match/', p_match_id)
     OR (n.data ->> 'messageId') IN (
          SELECT mm.id::text
          FROM public.match_messages mm
          WHERE mm.match_id = p_match_id
        )
     OR (n.data ->> 'requestId') IN (
          SELECT r.id::text
          FROM public.match_join_requests r
          WHERE r.match_id = p_match_id
        );

  DELETE FROM public.match_messages WHERE match_id = p_match_id;
  DELETE FROM public.match_join_requests WHERE match_id = p_match_id;
  DELETE FROM public.match_players WHERE match_id = p_match_id;
  DELETE FROM public.featured_matches WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'matchId', p_match_id);
END;
$$;

-- Backward-compatible overload used by older clients.
CREATE OR REPLACE FUNCTION public.delete_match(p_match_id uuid, p_requester_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester uuid := auth.uid();
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para eliminar un partido';
  END IF;

  IF p_requester_id IS NOT NULL AND p_requester_id IS DISTINCT FROM v_requester THEN
    RAISE EXCEPTION 'El requester no coincide con auth.uid()';
  END IF;

  RETURN public.delete_match(p_match_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match(uuid, uuid) TO authenticated;

-- --- 2) Join request RPC with duplicate-safe result ---
CREATE OR REPLACE FUNCTION public.request_join_match(p_match_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_creator uuid;
  v_request_id uuid;
BEGIN
  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para solicitar unirte';
  END IF;

  IF p_user_id IS DISTINCT FROM v_auth THEN
    RAISE EXCEPTION 'No autorizado: p_user_id no coincide con auth.uid()';
  END IF;

  SELECT creator_id INTO v_creator
  FROM public.matches
  WHERE id = p_match_id;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_creator = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'alreadyCreator', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id AND mp.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'alreadyJoined', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.match_join_requests r
    WHERE r.match_id = p_match_id
      AND r.user_id = p_user_id
      AND r.status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'alreadyRequested', true);
  END IF;

  INSERT INTO public.match_join_requests (match_id, user_id, status)
  VALUES (p_match_id, p_user_id, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('ok', true, 'requestId', v_request_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'alreadyRequested', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_join_match(uuid, uuid) TO authenticated;

-- --- 3) Notification dedupe clean-up before unique indexes ---
WITH ranked AS (
  SELECT
    n.id,
    ROW_NUMBER() OVER (
      PARTITION BY n.user_id, n.type, (n.data ->> 'messageId')
      ORDER BY n.created_at, n.id
    ) AS rn
  FROM public.notifications n
  WHERE n.type = 'new_chat_message'
    AND n.data ? 'messageId'
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    n.id,
    ROW_NUMBER() OVER (
      PARTITION BY n.user_id, n.type, (n.data ->> 'requestId')
      ORDER BY n.created_at, n.id
    ) AS rn
  FROM public.notifications n
  WHERE n.type = 'match_join_request'
    AND n.data ? 'requestId'
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_chat_message_per_user
  ON public.notifications (user_id, type, ((data ->> 'messageId')))
  WHERE type = 'new_chat_message' AND data ? 'messageId';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_join_request_per_user
  ON public.notifications (user_id, type, ((data ->> 'requestId')))
  WHERE type = 'match_join_request' AND data ? 'requestId';

-- --- 4) Join-request trigger normalized and deduped ---
CREATE OR REPLACE FUNCTION public.create_match_join_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, data)
  SELECT
    m.creator_id,
    'match_join_request',
    'Tenés una nueva solicitud para unirte al partido',
    jsonb_build_object(
      'requestId', NEW.id,
      'matchId', NEW.match_id,
      'userId', NEW.user_id,
      'path', CONCAT('/match/', NEW.match_id)
    )
  FROM public.matches m
  WHERE m.id = NEW.match_id
    AND m.creator_id IS NOT NULL
    AND m.creator_id <> NEW.user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = m.creator_id
        AND n.type = 'match_join_request'
        AND (n.data ->> 'requestId') = NEW.id::text
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_match_join_request ON public.match_join_requests;
DROP TRIGGER IF EXISTS trigger_match_join_notification ON public.match_join_requests;
CREATE TRIGGER trigger_match_join_notification
AFTER INSERT ON public.match_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_match_join_notification();

-- --- 5) Chat trigger normalized and deduped ---
CREATE OR REPLACE FUNCTION public.create_chat_notifications()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT p.name INTO sender_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  WITH recipients AS (
    SELECT mp.user_id AS user_id
    FROM public.match_players mp
    WHERE mp.match_id = NEW.match_id
      AND mp.user_id IS NOT NULL
      AND mp.user_id <> NEW.user_id

    UNION

    SELECT m.creator_id AS user_id
    FROM public.matches m
    WHERE m.id = NEW.match_id
      AND m.creator_id IS NOT NULL
      AND m.creator_id <> NEW.user_id
  )
  INSERT INTO public.notifications (user_id, type, message, data)
  SELECT
    r.user_id,
    'new_chat_message',
    'Nuevo mensaje de ' || COALESCE(sender_name, 'alguien') || ' en el partido',
    jsonb_build_object(
      'matchId', NEW.match_id,
      'messageId', NEW.id,
      'path', CONCAT('/match/', NEW.match_id)
    )
  FROM recipients r
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = r.user_id
      AND n.type = 'new_chat_message'
      AND (n.data ->> 'messageId') = NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_match_message_notification ON public.match_messages;
DROP TRIGGER IF EXISTS trigger_chat_notification ON public.match_messages;
CREATE TRIGGER trigger_chat_notification
AFTER INSERT ON public.match_messages
FOR EACH ROW
EXECUTE FUNCTION public.create_chat_notifications();

-- Rollback guide (manual, commented):
-- 1) Restore function definitions from the backups generated with pg_get_functiondef.
-- 2) DROP TRIGGER trigger_chat_notification ON public.match_messages;
-- 3) DROP TRIGGER trigger_match_join_notification ON public.match_join_requests;
-- 4) DROP INDEX IF EXISTS notifications_unique_chat_message_per_user;
-- 5) DROP INDEX IF EXISTS notifications_unique_join_request_per_user;
