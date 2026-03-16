-- Migration: add delete_match RPC (UUID-aware)
-- Ejecutar en Supabase SQL editor o con psql.

CREATE OR REPLACE FUNCTION public.delete_match(p_match_id uuid, p_requester_id uuid)
RETURNS void AS $$
DECLARE
  m_creator uuid;
BEGIN
  -- Ensure match exists and fetch its creator/organizer
  SELECT COALESCE(creator_id, organizer_id) INTO m_creator FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Authorization: only creator/organizer may delete (adjust if you want admin override)
  IF m_creator IS DISTINCT FROM p_requester_id THEN
    RAISE EXCEPTION 'Unauthorized to delete match';
  END IF;

  -- Remove related notifications that reference this match (data->>'matchId' stored as text)
  DELETE FROM public.notifications
  WHERE data IS NOT NULL AND (data->>'matchId') = p_match_id::text;

  -- Remove messages, join requests, players, featured entries and finally the match
  DELETE FROM public.match_messages WHERE match_id = p_match_id;
  DELETE FROM public.match_join_requests WHERE match_id = p_match_id;
  DELETE FROM public.match_players WHERE match_id = p_match_id;
  DELETE FROM public.featured_matches WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow callers to execute the function (Supabase will call it from the client via RPC)
GRANT EXECUTE ON FUNCTION public.delete_match(uuid, uuid) TO public;

-- Nota: Ejecuta este archivo en Supabase para habilitar eliminación segura de partidos (UUID schema).
