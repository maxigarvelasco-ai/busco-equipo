-- Backup: concatenated migrations backup
-- Generated: 2026-03-15 21:44 UTC

-- --------------------------------------------------
-- 20260315_add_notifications_data_and_triggers.sql
-- --------------------------------------------------

-- Migration: add data jsonb to notifications, create trigger for match_join_requests, and optional backfill
-- Ejecutar este archivo en el editor SQL de Supabase o con psql conectado a la BD.

-- 1) Añadir columna data a notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb;

-- 2) Función + trigger para crear notificación cuando llegue una solicitud de unión
CREATE OR REPLACE FUNCTION public.create_match_join_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, data)
  SELECT m.creator_id,
         'match_join_request',
         'A player requested to join your match',
         jsonb_build_object('requestId', NEW.id, 'matchId', NEW.match_id, 'userId', NEW.user_id)
  FROM public.matches m
  WHERE m.id = NEW.match_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_match_join_notification ON public.match_join_requests;
CREATE TRIGGER trigger_match_join_notification
AFTER INSERT ON public.match_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_match_join_notification();

-- 3) (Opcional) Backfill: crear notificaciones para requests existentes que no tengan notificación
INSERT INTO public.notifications (user_id, type, message, data)
SELECT m.creator_id,
       'match_join_request',
       'A player requested to join your match',
       jsonb_build_object('requestId', r.id, 'matchId', r.match_id, 'userId', r.user_id)
FROM public.match_join_requests r
JOIN public.matches m ON m.id = r.match_id
LEFT JOIN public.notifications n ON (n.data ->> 'requestId') = r.id::text
WHERE n.id IS NULL;

-- --------------------------------------------------
-- 20260315_update_accept_reject_rpc.sql
-- --------------------------------------------------

-- Migration: improve accept/reject RPCs for match join requests
-- - mark request accepted/rejected
-- - insert player record if accepted
-- - update matches.current_players and is_full if columns exist
-- - create notification to the requester informing result

-- ACCEPT
CREATE OR REPLACE FUNCTION public.accept_match_request(
  p_match_id uuid,
  p_request_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
DECLARE
  players_count int;
  requester uuid;
  max_players_int int;
  col_exists int;
BEGIN
  -- mark request accepted
  UPDATE public.match_join_requests
  SET status = 'accepted'
  WHERE id = p_request_id AND match_id = p_match_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_join_request not found or mismatched ids';
  END IF;

  -- insert player if not exists
  INSERT INTO public.match_players (match_id, user_id)
  SELECT p_match_id, p_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND user_id = p_user_id
  );

  -- compute current players
  SELECT COUNT(*) INTO players_count FROM public.match_players WHERE match_id = p_match_id;

  -- if matches.current_players column exists, update it
  SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'current_players';
  IF col_exists > 0 THEN
    EXECUTE 'UPDATE public.matches SET current_players = $1 WHERE id = $2' USING players_count, p_match_id;
  END IF;

  -- if matches.max_players exists and is_full column exists, update is_full
  SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'max_players';
  IF col_exists > 0 THEN
    SELECT max_players INTO max_players_int FROM public.matches WHERE id = p_match_id;
    -- check if is_full column exists
    SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'is_full';
    IF col_exists > 0 THEN
      IF max_players_int IS NOT NULL THEN
        EXECUTE 'UPDATE public.matches SET is_full = $1 WHERE id = $2' USING (players_count >= max_players_int), p_match_id;
      END IF;
    END IF;
  END IF;

  -- notify requester (the user who requested) that request was accepted
  requester := p_user_id;
  INSERT INTO public.notifications (user_id, type, message, data)
  VALUES (
    requester,
    'match_request_accepted',
    'Your request to join the match was accepted',
    jsonb_build_object('requestId', p_request_id, 'matchId', p_match_id, 'userId', p_user_id)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REJECT
CREATE OR REPLACE FUNCTION public.reject_match_request(
  p_match_id uuid,
  p_request_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
DECLARE
  requester uuid;
BEGIN
  UPDATE public.match_join_requests
  SET status = 'rejected'
  WHERE id = p_request_id AND match_id = p_match_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_join_request not found or mismatched ids';
  END IF;

  -- notify requester
  requester := p_user_id;
  INSERT INTO public.notifications (user_id, type, message, data)
  VALUES (
    requester,
    'match_request_rejected',
    'Your request to join the match was rejected',
    jsonb_build_object('requestId', p_request_id, 'matchId', p_match_id, 'userId', p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.accept_match_request(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_match_request(uuid, uuid, uuid) TO anon, authenticated;

-- --------------------------------------------------
-- 20260315_remove_match_join_notification_trigger.sql
-- --------------------------------------------------

-- Migration: remove trigger/function that created notifications on match_join_requests insert
-- Ejecutar en el editor SQL de Supabase o con psql conectado a la BD.

-- 1) Eliminar el trigger que insertaba notificaciones al crear una solicitud
DROP TRIGGER IF EXISTS trigger_match_join_notification ON public.match_join_requests;

-- 2) Eliminar la función asociada (si no se usa en otro lado)
DROP FUNCTION IF EXISTS public.create_match_join_notification();

-- Nota: este archivo solo elimina el trigger/función que automáticamente
-- insertaba filas en `notifications` cuando se creaba una fila en
-- `match_join_requests`. No borra notificaciones ya creadas.

-- --------------------------------------------------
-- 20260315_add_match_message_notifications.sql
-- --------------------------------------------------

-- Migration: create notifications for new match messages (notify match creator)
-- Ejecutar en Supabase SQL Editor o con psql.

-- 1) Function: insert notification when a new message is posted in match_messages
CREATE OR REPLACE FUNCTION public.create_match_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  m_creator uuid;
BEGIN
  -- find match creator
  SELECT creator_id INTO m_creator FROM public.matches WHERE id = NEW.match_id;
  -- if creator exists and is not the sender, insert notification for creator
  IF m_creator IS NOT NULL AND m_creator <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, message, data)
    VALUES (
      m_creator,
      'new_chat_message',
      'New message in your match',
      jsonb_build_object('matchId', NEW.match_id, 'messageId', NEW.id, 'path', CONCAT('/match/', NEW.match_id))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Trigger
DROP TRIGGER IF EXISTS trigger_match_message_notification ON public.match_messages;
CREATE TRIGGER trigger_match_message_notification
AFTER INSERT ON public.match_messages
FOR EACH ROW
EXECUTE FUNCTION public.create_match_message_notification();

-- Nota: este trigger notifica SOLO al creador del partido cuando otro usuario escribe. Si querés notificar a todos los jugadores, puedo ajustar la función para iterar sobre match_players.
