-- Migration: remove trigger/function that created notifications on match_join_requests insert
-- Ejecutar en el editor SQL de Supabase o con psql conectado a la BD.

-- 1) Eliminar el trigger que insertaba notificaciones al crear una solicitud
DROP TRIGGER IF EXISTS trigger_match_join_notification ON public.match_join_requests;

-- 2) Eliminar la función asociada (si no se usa en otro lado)
DROP FUNCTION IF EXISTS public.create_match_join_notification();

-- Nota: este archivo solo elimina el trigger/función que automáticamente
-- insertaba filas en `notifications` cuando se creaba una fila en
-- `match_join_requests`. No borra notificaciones ya creadas.
