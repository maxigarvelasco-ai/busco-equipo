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
