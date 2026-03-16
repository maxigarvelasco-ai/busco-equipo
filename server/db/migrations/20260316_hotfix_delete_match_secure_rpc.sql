-- Hotfix final: avoid overloaded RPC ambiguity by using a single dedicated delete RPC
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.delete_match_secure(
  p_match_id uuid,
  p_requester_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_creator uuid;
BEGIN
  IF p_requester_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para eliminar un partido';
  END IF;

  -- If JWT context is available, enforce identity match.
  IF v_auth IS NOT NULL AND v_auth IS DISTINCT FROM p_requester_id THEN
    RAISE EXCEPTION 'No autorizado: requester inválido';
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_creator IS DISTINCT FROM p_requester_id THEN
    RAISE EXCEPTION 'No autorizado: solo el creador puede eliminar el partido';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.delete_match_secure(uuid, uuid) TO authenticated;
