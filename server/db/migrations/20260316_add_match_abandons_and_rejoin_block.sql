-- Feature: track abandoned matches and block re-join if user left within 3 hours of kickoff

CREATE TABLE IF NOT EXISTS public.match_abandons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  abandoned_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE OR REPLACE FUNCTION public.log_match_abandon_on_leave()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_kickoff timestamptz;
BEGIN
  SELECT (m.match_date::text || ' ' || m.match_time::text)::timestamptz
  INTO v_kickoff
  FROM public.matches m
  WHERE m.id = OLD.match_id;

  -- If user leaves within the last 3 hours before kickoff, mark as abandoned.
  IF v_kickoff IS NOT NULL
     AND now() >= (v_kickoff - interval '3 hours')
     AND now() < v_kickoff THEN
    INSERT INTO public.match_abandons (match_id, user_id, abandoned_at, reason)
    VALUES (OLD.match_id, OLD.user_id, now(), 'left_within_3h')
    ON CONFLICT (match_id, user_id)
    DO UPDATE SET abandoned_at = EXCLUDED.abandoned_at,
                  reason = EXCLUDED.reason;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_match_abandon_on_leave ON public.match_players;
CREATE TRIGGER trigger_log_match_abandon_on_leave
AFTER DELETE ON public.match_players
FOR EACH ROW
EXECUTE FUNCTION public.log_match_abandon_on_leave();

-- Recreate request_join_match adding re-join block for abandoned users.
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
    FROM public.match_abandons a
    WHERE a.match_id = p_match_id
      AND a.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'blockedByAbandon', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.match_players mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = p_user_id
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
