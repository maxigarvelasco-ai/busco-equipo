-- Migration: improve accept/reject RPCs for match join requests
-- - mark request accepted/rejected
-- - insert player record if accepted
-- - update matches.current_players and is_full if columns exist
-- - create notification to the requester informing result

-- ACCEPT
CREATE OR REPLACE FUNCTION public.accept_match_request(
  p_match_id uuid,
  p_request_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
DECLARE
  players_count int;
  requester uuid;
  max_players_int int;
  col_exists int;
BEGIN
  -- mark request accepted
  UPDATE public.match_join_requests
  SET status = 'accepted'
  WHERE id = p_request_id AND match_id = p_match_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_join_request not found or mismatched ids';
  END IF;

  -- insert player if not exists
  INSERT INTO public.match_players (match_id, user_id)
  SELECT p_match_id, p_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.match_players WHERE match_id = p_match_id AND user_id = p_user_id
  );

  -- compute current players
  SELECT COUNT(*) INTO players_count FROM public.match_players WHERE match_id = p_match_id;

  -- if matches.current_players column exists, update it
  SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'current_players';
  IF col_exists > 0 THEN
    EXECUTE 'UPDATE public.matches SET current_players = $1 WHERE id = $2' USING players_count, p_match_id;
  END IF;

  -- if matches.max_players exists and is_full column exists, update is_full
  SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'max_players';
  IF col_exists > 0 THEN
    SELECT max_players INTO max_players_int FROM public.matches WHERE id = p_match_id;
    -- check if is_full column exists
    SELECT COUNT(*) INTO col_exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'matches' AND column_name = 'is_full';
    IF col_exists > 0 THEN
      IF max_players_int IS NOT NULL THEN
        EXECUTE 'UPDATE public.matches SET is_full = $1 WHERE id = $2' USING (players_count >= max_players_int), p_match_id;
      END IF;
    END IF;
  END IF;

  -- notify requester (the user who requested) that request was accepted
  requester := p_user_id;
  INSERT INTO public.notifications (user_id, type, message, data)
  VALUES (
    requester,
    'match_request_accepted',
    'Your request to join the match was accepted',
    jsonb_build_object('requestId', p_request_id, 'matchId', p_match_id, 'userId', p_user_id)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- REJECT
CREATE OR REPLACE FUNCTION public.reject_match_request(
  p_match_id uuid,
  p_request_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
DECLARE
  requester uuid;
BEGIN
  UPDATE public.match_join_requests
  SET status = 'rejected'
  WHERE id = p_request_id AND match_id = p_match_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match_join_request not found or mismatched ids';
  END IF;

  -- notify requester
  requester := p_user_id;
  INSERT INTO public.notifications (user_id, type, message, data)
  VALUES (
    requester,
    'match_request_rejected',
    'Your request to join the match was rejected',
    jsonb_build_object('requestId', p_request_id, 'matchId', p_match_id, 'userId', p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.accept_match_request(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_match_request(uuid, uuid, uuid) TO anon, authenticated;
