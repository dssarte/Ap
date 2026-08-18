-- notify_ticket_participants always attributed notifications to whoever
-- called it (private.current_email()). For the auto-response feature, that
-- caller is the same person who just created the ticket, so the Overview nav
-- dot's self-notification filter was hiding the auto-response comment from
-- the very person it's meant to notify. Add an optional p_created_by so
-- system-generated notifications can be attributed to a sentinel instead.

BEGIN;

DROP FUNCTION IF EXISTS public.notify_ticket_participants(text, text, text);

CREATE OR REPLACE FUNCTION public.notify_ticket_participants(
  p_ticket_id text,
  p_type text DEFAULT 'updated',
  p_message text DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text := private.current_email();
  notify_as text := coalesce(nullif(trim(p_created_by), ''), caller_email);
  current_ticket public.tickets;
  now_utc timestamptz := now();
  inserted_count integer := 0;
BEGIN
  IF caller_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT private.can_access_ticket(p_ticket_id) THEN
    RAISE EXCEPTION 'You are not allowed to notify participants of this ticket';
  END IF;

  SELECT * INTO current_ticket
  FROM public.tickets
  WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  WITH recipients AS (
    SELECT lower(trim(address)) AS email
    FROM (VALUES
      (current_ticket.submitter_email),
      (current_ticket.assigned_to),
      (current_ticket.approver_email)
    ) AS direct(address)
    WHERE nullif(trim(coalesce(address, '')), '') IS NOT NULL
    UNION
    SELECT lower(trim(u.email))
    FROM public.users AS u
    WHERE nullif(trim(coalesce(u.email, '')), '') IS NOT NULL
      AND lower(coalesce(u.disabled::text, 'false')) <> 'true'
      AND u.user_type IN ('admin', 'department_head', 'staff')
      AND (
        u.user_type = 'admin'
        OR u.department_id = coalesce(
          current_ticket.handling_department_id,
          current_ticket.department_id
        )
      )
  )
  INSERT INTO public.notifications (
    id, created_date, updated_date, created_by, user_email, ticket_id,
    type, title, message, link, is_read, is_sample
  )
  SELECT
    gen_random_uuid()::text, now_utc, now_utc, notify_as, recipients.email,
    current_ticket.id, coalesce(nullif(p_type, ''), 'updated'),
    'Ticket #' || left(current_ticket.id, 8) || ' - ' || coalesce(nullif(p_type, ''), 'updated'),
    coalesce(nullif(p_message, ''), 'Ticket ' || coalesce(current_ticket.title, '') || ' was updated'),
    '/ticket/' || current_ticket.id, false, false
  FROM recipients;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ticket_participants(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_ticket_participants(text, text, text, text) TO authenticated;

COMMIT;
