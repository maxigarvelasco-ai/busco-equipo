-- Hotfix: make delete_match robust for creator checks and enforce pending join-request uniqueness
--
-- This migration addresses:
-- 1) creators unable to delete matches in some auth contexts
-- 2) duplicated pending join requests

-- 1) Enforce one pending request per (match_id, user_id)
--    Cleanup existing duplicates first (keep oldest row)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY match_id, user_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.match_join_requests
  WHERE status = 'pending'
)
DELETE FROM public.match_join_requests r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS match_join_requests_unique_pending
  ON public.match_join_requests (match_id, user_id)
  WHERE status = 'pending';

-- 2) Recreate delete_match overloads with robust requester resolution
DROP FUNCTION IF EXISTS public.delete_match(uuid);
DROP FUNCTION IF EXISTS public.delete_match(uuid, uuid);

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

  DELETE FROM public.notifications n
  WHERE (n.data ->> 'matchId') = p_match_id::text
     OR (n.data ->> 'path') = CONCAT('/match/', p_match_id)
     OR (n.data ->> 'messageId') IN (
          SELECT mm.id::text FROM public.match_messages mm WHERE mm.match_id = p_match_id
        )
     OR (n.data ->> 'requestId') IN (
          SELECT r.id::text FROM public.match_join_requests r WHERE r.match_id = p_match_id
        );

  DELETE FROM public.match_messages WHERE match_id = p_match_id;
  DELETE FROM public.match_join_requests WHERE match_id = p_match_id;
  DELETE FROM public.match_players WHERE match_id = p_match_id;
  DELETE FROM public.featured_matches WHERE match_id = p_match_id;
  DELETE FROM public.matches WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'matchId', p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_match(p_match_id uuid, p_requester_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid := auth.uid();
  v_effective_requester uuid;
  v_creator uuid;
BEGIN
  -- If auth.uid() is available, trust it and require parameter consistency when provided.
  IF v_auth IS NOT NULL THEN
    IF p_requester_id IS NOT NULL AND p_requester_id IS DISTINCT FROM v_auth THEN
      RAISE EXCEPTION 'El requester no coincide con auth.uid()';
    END IF;
    v_effective_requester := v_auth;
  ELSE
    -- Fallback for contexts where auth.uid() is unavailable but explicit requester is passed.
    IF p_requester_id IS NULL THEN
      RAISE EXCEPTION 'Debes iniciar sesión para eliminar un partido';
    END IF;
    v_effective_requester := p_requester_id;
  END IF;

  SELECT m.creator_id INTO v_creator
  FROM public.matches m
  WHERE m.id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partido no encontrado';
  END IF;

  IF v_creator IS DISTINCT FROM v_effective_requester THEN
    RAISE EXCEPTION 'No autorizado: solo el creador puede eliminar el partido';
  END IF;

  RETURN public.delete_match(p_match_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_match(uuid, uuid) TO authenticated;

-- 3) Recreate request_join_match to align with unique pending index behavior
DROP FUNCTION IF EXISTS public.request_join_match(uuid, uuid);

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
