-- Migration: add delete_match RPC to safely delete a match and related data
-- Ejecutar en Supabase SQL editor o con psql.

CREATE OR REPLACE FUNCTION public.delete_match(p_match_id integer, p_requester_id integer)
RETURNS void AS $$
BEGIN
  -- Authorization: requester must be organizer or admin
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id AND organizer_id = p_requester_id)
     AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_requester_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized to delete match';
  END IF;

  -- Remove related notifications that reference this match
  DELETE FROM public.notifications
  WHERE data IS NOT NULL AND (data->>'matchId') IS NOT NULL AND (data->>'matchId')::int = p_match_id;

  -- Remove messages, join requests, players, featured entries and finally the match
  DELETE FROM public.match_messages WHERE match_id = p_match_id;
  DELETE FROM public.match_join_requests WHERE match_id = p_match_id;
  DELETE FROM public.match_players WHERE match_id = p_match_id;
  DELETE FROM public.featured_matches WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow callers to execute the function (Supabase will call it from the client via RPC)
GRANT EXECUTE ON FUNCTION public.delete_match(integer, integer) TO public;

-- Nota: Ejecuta este archivo en Supabase para habilitar eliminación segura de partidos.
