-- submit_audit_bundle never explicitly set is_draft on the row it builds.
-- jsonb_populate_record(NULL::audit_submissions, payload) starts from a
-- BLANK record (not the column's table-level default), so any key the
-- payload doesn't mention — is_draft, since this function is only ever
-- used for REAL (non-draft) submissions — came out as a literal NULL. That
-- violated is_draft's NOT NULL constraint the moment it was re-added
-- (20261008020000), regardless of whether the client sends the field.
-- Drafts never go through this function (they're a direct insert/update
-- from the client, or finalize_audit_draft, both of which already set
-- is_draft explicitly) — so this function should always force it to false.
CREATE OR REPLACE FUNCTION public.submit_audit_bundle(
  p_submission jsonb,
  p_tickets jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text := private.current_email();
  submission_payload jsonb;
  ticket_payload jsonb;
  saved_submission public.audit_submissions;
  saved_ticket public.tickets;
  saved_tickets jsonb := '[]'::jsonb;
  ticket_item jsonb;
  now_utc timestamptz := now();
  ticket_count integer;
  sla_policy public.slas;
  template_requires_audit_type boolean;
  template_requires_visit_number boolean;
BEGIN
  IF caller_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF lower(coalesce(p_submission ->> 'submitted_by_email', '')) <> caller_email
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Audit submitter must match the signed-in user';
  END IF;

  SELECT coalesce(t.requires_audit_type, false), coalesce(t.requires_visit_number, false)
  INTO template_requires_audit_type, template_requires_visit_number
  FROM public.audit_templates t
  WHERE t.id = p_submission ->> 'template_id'
    AND coalesce(t.is_active, true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected audit template is missing or inactive';
  END IF;

  IF template_requires_audit_type AND NOT private.is_qa_or_admin() THEN
    RAISE EXCEPTION 'Only Quality Assurance can submit this audit checklist';
  END IF;

  IF template_requires_audit_type
     AND coalesce(nullif(trim(p_submission ->> 'audit_type'), ''), '') NOT IN ('unannounced', 'follow_up', 'spot') THEN
    RAISE EXCEPTION 'Please select an Audit Type (Unannounced, Follow-up, or Spot) before submitting this checklist';
  END IF;

  IF template_requires_visit_number
     AND coalesce(nullif(trim(p_submission ->> 'visit_number'), ''), '') NOT IN ('first', 'second') THEN
    RAISE EXCEPTION 'Please select a Visit (First Visit or Second Visit) before submitting this checklist';
  END IF;

  IF jsonb_typeof(coalesce(p_tickets, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_tickets must be a JSON array';
  END IF;

  ticket_count := jsonb_array_length(coalesce(p_tickets, '[]'::jsonb));
  IF ticket_count > 100 THEN
    RAISE EXCEPTION 'An audit cannot generate more than 100 concern tickets';
  END IF;

  submission_payload := p_submission || jsonb_build_object(
    'id', coalesce(nullif(p_submission ->> 'id', ''), gen_random_uuid()::text),
    'created_date', now_utc,
    'updated_date', now_utc,
    'submission_date', coalesce(nullif(p_submission ->> 'submission_date', '')::timestamptz, now_utc),
    'submitted_by_email', caller_email,
    'created_by', caller_email,
    'is_draft', false
  );

  INSERT INTO public.audit_submissions
  SELECT (jsonb_populate_record(NULL::public.audit_submissions, submission_payload)).*
  RETURNING * INTO saved_submission;

  FOR ticket_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb))
  LOOP
    IF lower(coalesce(ticket_item ->> 'submitter_email', caller_email)) <> caller_email
       AND NOT private.is_admin() THEN
      RAISE EXCEPTION 'Generated ticket submitter must match the signed-in user';
    END IF;

    ticket_payload := ticket_item || jsonb_build_object(
      'id', coalesce(nullif(ticket_item ->> 'id', ''), gen_random_uuid()::text),
      'created_date', now_utc,
      'updated_date', now_utc,
      'created_by', caller_email,
      'submitter_email', caller_email,
      'audit_submission_id', saved_submission.id,
      'audit_template_id', saved_submission.template_id
    );

    INSERT INTO public.tickets
    SELECT (jsonb_populate_record(NULL::public.tickets, ticket_payload)).*
    RETURNING * INTO saved_ticket;

    SELECT policy.* INTO sla_policy
    FROM public.slas AS policy
    WHERE coalesce(policy.is_active, true)
      AND policy.priority = coalesce(saved_ticket.priority, 'medium')
      AND (
        policy.department_id IS NULL
        OR policy.department_id = saved_ticket.handling_department_id
        OR policy.department_id = saved_ticket.department_id
      )
    ORDER BY (policy.department_id IS NOT NULL) DESC, policy.created_date DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.tickets
      SET sla_id = sla_policy.id,
          sla_response_due = coalesce(saved_ticket.approved_at, saved_ticket.created_date, now_utc)
            + make_interval(hours => coalesce(sla_policy.response_time_hours, 0)),
          sla_resolution_due = coalesce(saved_ticket.approved_at, saved_ticket.created_date, now_utc)
            + make_interval(hours => coalesce(sla_policy.resolution_time_hours, 0)),
          sla_response_breached = false,
          sla_resolution_breached = false,
          updated_date = now_utc
      WHERE id = saved_ticket.id
      RETURNING * INTO saved_ticket;
    END IF;

    saved_tickets := saved_tickets || to_jsonb(saved_ticket);
  END LOOP;

  RETURN jsonb_build_object(
    'submission', to_jsonb(saved_submission),
    'tickets', saved_tickets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_audit_bundle(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_audit_bundle(jsonb, jsonb) TO authenticated;
