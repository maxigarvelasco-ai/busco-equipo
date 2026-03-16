-- Migration: Fix chat notifications and remove duplicate notification triggers
-- 1) Ensure no duplicate triggers/functions remain and remove old function that used 'content'
DROP TRIGGER IF EXISTS trigger_match_message_notification ON public.match_messages;
DROP FUNCTION IF EXISTS public.create_match_message_notification();

-- 2) Replace create_chat_notifications to insert into the `message` column and build jsonb `data`
CREATE OR REPLACE FUNCTION public.create_chat_notifications()
RETURNS trigger AS $$
DECLARE
  match_info RECORD;
  sender_name TEXT;
BEGIN
  -- Get match info (creator, zone) if available
  SELECT m.creator_id, m.zone INTO match_info FROM public.matches m WHERE m.id = NEW.match_id;

  -- Get sender name from profiles if available
  SELECT name INTO sender_name FROM public.profiles WHERE id = NEW.user_id;

  -- Insert notifications for all players in the match except the sender
  INSERT INTO public.notifications (user_id, type, message, data)
  SELECT
    mp.user_id,
    'new_chat_message',
    'Nuevo mensaje de ' || COALESCE(sender_name, 'alguien') || ' en el partido' || COALESCE(' en ' || match_info.zone, ''),
    jsonb_build_object('matchId', NEW.match_id, 'messageId', NEW.id, 'path', CONCAT('/match/', NEW.match_id))
  FROM public.match_players mp
  WHERE mp.match_id = NEW.match_id
    AND mp.user_id IS NOT NULL
    AND mp.user_id <> NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Recreate the trigger to call the corrected function
DROP TRIGGER IF EXISTS trigger_chat_notification ON public.match_messages;
CREATE TRIGGER trigger_chat_notification
AFTER INSERT ON public.match_messages
FOR EACH ROW
EXECUTE FUNCTION public.create_chat_notifications();

-- Note: This migration replaces usage of the non-existent `content` column with `message` and
-- formats the `data` payload as jsonb. Run this in Supabase SQL Editor.
