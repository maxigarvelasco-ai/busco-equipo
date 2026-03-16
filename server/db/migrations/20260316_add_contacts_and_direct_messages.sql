-- Feature: contacts and direct messages between profiles

CREATE TABLE IF NOT EXISTS public.user_contacts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contact_user_id),
  CONSTRAINT user_contacts_not_self CHECK (user_id <> contact_user_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_not_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_from_to_idx
  ON public.direct_messages (from_user_id, to_user_id, created_at);

CREATE INDEX IF NOT EXISTS direct_messages_to_from_idx
  ON public.direct_messages (to_user_id, from_user_id, created_at);
