-- Hotfix: robust auth resolution for delete_match_secure and stricter execute grants
-- Use when creators still cannot delete due to missing auth.uid() context in RPC.

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
  v_auth uuid;
  v_claim_sub text;
  v_creator uuid;
BEGIN
  IF p_requester_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para eliminar un partido';
  END IF;

  -- Primary source in Supabase RPC context.
  v_auth := auth.uid();

  -- Fallback: some contexts expose JWT claim in request settings.
  IF v_auth IS NULL THEN
    v_claim_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
    IF v_claim_sub IS NOT NULL THEN
      v_auth := v_claim_sub::uuid;
    END IF;
  END IF;

  IF v_auth IS NULL THEN
    v_claim_sub := NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '');
    IF v_claim_sub IS NOT NULL THEN
      v_auth := v_claim_sub::uuid;
    END IF;
  END IF;

  IF v_auth IS NULL THEN
    RAISE EXCEPTION 'No autorizado: no se pudo resolver identidad JWT';
  END IF;

  IF v_auth IS DISTINCT FROM p_requester_id THEN
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

-- Tighten execution privileges for safety.
REVOKE EXECUTE ON FUNCTION public.delete_match_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_match_secure(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_match_secure(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match_secure(uuid, uuid) TO service_role;
