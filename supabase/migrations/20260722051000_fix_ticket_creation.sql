-- Create manual tickets and participant notifications through validated,
-- server-side functions. This keeps RLS strict without trusting caller fields.

CREATE OR REPLACE FUNCTION public.create_manual_ticket(p_ticket jsonb)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text := private.current_email();
  caller_profile jsonb := private.current_profile();
  ticket_payload jsonb;
  saved_ticket public.tickets;
  now_utc timestamptz := now();
BEGIN
  IF caller_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF caller_profile = '{}'::jsonb THEN
    RAISE EXCEPTION 'An application user profile is required';
  END IF;
  IF lower(coalesce(caller_profile ->> 'disabled', 'false')) = 'true' THEN
    RAISE EXCEPTION 'This account is disabled';
  END IF;
  IF nullif(trim(coalesce(p_ticket ->> 'title', '')), '') IS NULL
     OR nullif(trim(coalesce(p_ticket ->> 'description', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Title and description are required';
  END IF;
  IF nullif(trim(coalesce(p_ticket ->> 'department_id', '')), '') IS NULL
     OR nullif(trim(coalesce(p_ticket ->> 'category_id', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Department and category are required';
  END IF;

  ticket_payload := p_ticket || jsonb_build_object(
    'id', gen_random_uuid()::text,
    'created_date', now_utc,
    'updated_date', now_utc,
    'created_by', caller_email,
    'submitter_email', caller_email,
    'submitter_name', coalesce(
      nullif(caller_profile ->> 'display_name', ''),
      nullif(caller_profile ->> 'full_name', ''),
      caller_email
    ),
    'status', 'pending_approval',
    'approval_status', 'pending',
    'approved_at', NULL,
    'resolved_at', NULL,
    'first_response_at', NULL,
    'escalated', false,
    'sla_response_breached', false,
    'sla_resolution_breached', false
  );

  INSERT INTO public.tickets
  SELECT (jsonb_populate_record(NULL::public.tickets, ticket_payload)).*
  RETURNING * INTO saved_ticket;

  RETURN saved_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.create_manual_ticket(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_ticket(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_participants(
  p_ticket_id text,
  p_type text DEFAULT 'updated',
  p_message text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text := private.current_email();
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
    gen_random_uuid()::text, now_utc, now_utc, caller_email, recipients.email,
    current_ticket.id, coalesce(nullif(p_type, ''), 'updated'),
    'Ticket #' || left(current_ticket.id, 8) || ' - ' || coalesce(nullif(p_type, ''), 'updated'),
    coalesce(nullif(p_message, ''), 'Ticket ' || coalesce(current_ticket.title, '') || ' was updated'),
    '/ticket/' || current_ticket.id, false, false
  FROM recipients;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ticket_participants(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_ticket_participants(text, text, text) TO authenticated;

-- Repair imported/legacy tickets that have no displayable creation timestamp.
UPDATE public.tickets
SET created_date = coalesce(created_date, approved_at, updated_date, now()),
    updated_date = coalesce(updated_date, created_date, approved_at, now())
WHERE created_date IS NULL OR updated_date IS NULL;

