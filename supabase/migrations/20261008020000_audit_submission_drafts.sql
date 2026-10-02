-- QA checklists can be long (100+ items) and don't require Ask Audit Type's
-- finalize-immediately workflow to be all-or-nothing — this adds a draft
-- state so progress can be saved and resumed later, without generating
-- concern tickets until the draft is actually finalized.
ALTER TABLE public.audit_submissions ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS audit_submissions_my_drafts_idx
  ON public.audit_submissions (submitted_by_email, is_draft)
  WHERE is_draft = true;

-- A stale blanket policy from initial local-testing scaffolding was still
-- active on this table (USING true / WITH CHECK true for every command),
-- silently making every other policy below moot since Postgres ORs
-- permissive policies together — any authenticated user could already
-- update or delete ANY row directly via the API, not just their own drafts.
-- Dropping it now because the owner-scoped policies below are about to
-- become load-bearing for real (letting a submitter edit their own draft),
-- so the fallback-permits-everything policy can no longer coexist safely.
DROP POLICY IF EXISTS "local_testing_all" ON public.audit_submissions;

-- Resuming and re-saving a draft is a direct table update (no RPC) — scoped
-- to the submitter's own rows, and only while still a draft. Finalizing a
-- draft (see finalize_audit_draft below) goes through SECURITY DEFINER
-- instead, so this policy never needs to allow flipping is_draft itself.
CREATE POLICY audit_submissions_owner_update_draft ON public.audit_submissions
FOR UPDATE TO authenticated
USING (
  is_draft = true
  AND lower(coalesce(submitted_by_email, '')) = private.current_email()
)
WITH CHECK (
  is_draft = true
  AND lower(coalesce(submitted_by_email, '')) = private.current_email()
);

CREATE POLICY audit_submissions_owner_delete_draft ON public.audit_submissions
FOR DELETE TO authenticated
USING (
  is_draft = true
  AND lower(coalesce(submitted_by_email, '')) = private.current_email()
);

-- Finalizing a draft: same shape as submit_audit_bundle (same validation,
-- same ticket-generation + SLA logic), but UPDATEs the existing draft row
-- in place instead of inserting a new one, and requires the target row to
-- actually be the caller's own draft.
CREATE OR REPLACE FUNCTION public.finalize_audit_draft(
  p_submission_id text,
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
  existing_draft public.audit_submissions;
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

  SELECT * INTO existing_draft
  FROM public.audit_submissions
  WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  IF NOT existing_draft.is_draft THEN
    RAISE EXCEPTION 'This submission has already been finalized';
  END IF;

  IF lower(coalesce(existing_draft.submitted_by_email, '')) <> caller_email
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'You can only finalize your own drafts';
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
    'id', p_submission_id,
    'updated_date', now_utc,
    'submission_date', coalesce(nullif(p_submission ->> 'submission_date', '')::timestamptz, now_utc),
    'submitted_by_email', caller_email,
    'is_draft', false
  );

  UPDATE public.audit_submissions
  SET
    template_id = submission_payload ->> 'template_id',
    template_title = submission_payload ->> 'template_title',
    submission_date = (submission_payload ->> 'submission_date')::timestamptz,
    submitted_by_email = caller_email,
    submitted_by_name = submission_payload ->> 'submitted_by_name',
    brand = submission_payload ->> 'brand',
    location = submission_payload ->> 'location',
    answers = coalesce(submission_payload -> 'answers', '{}'::jsonb),
    no_comments = coalesce(submission_payload -> 'no_comments', '{}'::jsonb),
    item_photos = coalesce(submission_payload -> 'item_photos', '{}'::jsonb),
    score = (submission_payload ->> 'score')::numeric,
    total_items = (submission_payload ->> 'total_items')::integer,
    yes_count = (submission_payload ->> 'yes_count')::integer,
    no_count = (submission_payload ->> 'no_count')::integer,
    na_count = (submission_payload ->> 'na_count')::integer,
    audit_type = nullif(submission_payload ->> 'audit_type', ''),
    visit_number = nullif(submission_payload ->> 'visit_number', ''),
    others = submission_payload ->> 'others',
    concerns_recommendations = submission_payload ->> 'concerns_recommendations',
    deviations_photo_urls = coalesce(submission_payload -> 'deviations_photo_urls', '[]'::jsonb),
    updates = submission_payload ->> 'updates',
    updates_attachment_urls = coalesce(submission_payload -> 'updates_attachment_urls', '[]'::jsonb),
    signature1_photo_url = submission_payload ->> 'signature1_photo_url',
    signature1_name = submission_payload ->> 'signature1_name',
    signature1_position = submission_payload ->> 'signature1_position',
    signature2_photo_url = submission_payload ->> 'signature2_photo_url',
    signature2_name = submission_payload ->> 'signature2_name',
    signature2_position = submission_payload ->> 'signature2_position',
    is_draft = false,
    updated_date = now_utc
  WHERE id = p_submission_id
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

REVOKE ALL ON FUNCTION public.finalize_audit_draft(text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_audit_draft(text, jsonb, jsonb) TO authenticated;
