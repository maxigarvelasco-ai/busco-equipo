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

-- Nota: Este archivo solo crea la migración. Ejecutalo en Supabase para aplicar los cambios.
