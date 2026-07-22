-- FCG HelpDesk: production scaling migration for 200 stores
-- Expected workload: ~600 audits/day, ~18,000 audits/month.
--
-- Run after complete_setup.sql and harden_rls_policies.sql.
-- This migration is idempotent and does not delete tickets or audit reports.

BEGIN;

-- Passwords belong only in Supabase Auth. Remove any legacy plaintext values
-- before dropping the unused application-table column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pending_users' AND column_name = 'password'
  ) THEN
    EXECUTE 'UPDATE public.pending_users SET password = NULL WHERE password IS NOT NULL';
  END IF;
END $$;
ALTER TABLE public.pending_users DROP COLUMN IF EXISTS password;

-- Operational metadata supports archiving without deleting audit history.
ALTER TABLE public.audit_submissions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_storage_path text;

-- Reporting and RLS indexes for the expected query patterns.
CREATE INDEX IF NOT EXISTS audit_submissions_date_idx
  ON public.audit_submissions (submission_date DESC);
CREATE INDEX IF NOT EXISTS audit_submissions_template_date_idx
  ON public.audit_submissions (template_id, submission_date DESC);
CREATE INDEX IF NOT EXISTS audit_submissions_brand_date_idx
  ON public.audit_submissions (brand, submission_date DESC);
CREATE INDEX IF NOT EXISTS audit_submissions_score_date_idx
  ON public.audit_submissions (submission_date DESC, score)
  WHERE score IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_submissions_active_date_idx
  ON public.audit_submissions (submission_date DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS tickets_status_date_idx
  ON public.tickets (status, created_date DESC);
CREATE INDEX IF NOT EXISTS tickets_approval_approver_idx
  ON public.tickets (approval_status, lower(approver_email), created_date DESC);
CREATE INDEX IF NOT EXISTS tickets_department_status_idx
  ON public.tickets (handling_department_id, status, created_date DESC);
CREATE INDEX IF NOT EXISTS tickets_store_status_idx
  ON public.tickets (store_name, status, created_date DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (lower(user_email), is_read, created_date DESC);

-- Keep uploads predictable. Existing files are unaffected.
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
WHERE id = 'attachments';

-- Date/store-filtered rows. SECURITY INVOKER means the caller's RLS scope is
-- still enforced. This is used by daily views and detailed exports.
CREATE OR REPLACE FUNCTION public.list_audit_submissions(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store_names text[] DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.audit_submissions
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT s.*
  FROM public.audit_submissions AS s
  WHERE s.archived_at IS NULL
    AND (
      p_date_from IS NULL
      OR coalesce(s.submission_date, s.created_date) >=
         (p_date_from::timestamp AT TIME ZONE 'Asia/Manila')
    )
    AND (
      p_date_to IS NULL
      OR coalesce(s.submission_date, s.created_date) <
         ((p_date_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    )
    AND (p_template_id IS NULL OR s.template_id = p_template_id)
    AND (
      p_store_names IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_store_names) AS requested(store_name)
        WHERE position(lower(requested.store_name) IN lower(coalesce(s.brand, ''))) > 0
      )
    )
  ORDER BY coalesce(s.submission_date, s.created_date) DESC
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.list_audit_submissions(date, date, text[], text, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_audit_submissions(date, date, text[], text, integer, integer)
  TO authenticated;

-- Compact store/template aggregates keep rankings accurate without sending
-- tens of thousands of full answer/photo JSON documents to the browser.
CREATE OR REPLACE FUNCTION public.audit_store_template_summary(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store_names text[] DEFAULT NULL
)
RETURNS TABLE (
  brand text,
  template_id text,
  template_title text,
  average_score numeric,
  audit_count bigint,
  passing_count bigint,
  first_submission timestamptz,
  latest_submission timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    s.brand,
    s.template_id,
    max(s.template_title) AS template_title,
    round(avg(s.score), 2) AS average_score,
    count(*) AS audit_count,
    count(*) FILTER (WHERE s.score >= 75) AS passing_count,
    min(coalesce(s.submission_date, s.created_date)) AS first_submission,
    max(coalesce(s.submission_date, s.created_date)) AS latest_submission
  FROM public.audit_submissions AS s
  WHERE s.archived_at IS NULL
    AND s.score IS NOT NULL
    AND (
      p_date_from IS NULL
      OR coalesce(s.submission_date, s.created_date) >=
         (p_date_from::timestamp AT TIME ZONE 'Asia/Manila')
    )
    AND (
      p_date_to IS NULL
      OR coalesce(s.submission_date, s.created_date) <
         ((p_date_to + 1)::timestamp AT TIME ZONE 'Asia/Manila')
    )
    AND (
      p_store_names IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_store_names) AS requested(store_name)
        WHERE position(lower(requested.store_name) IN lower(coalesce(s.brand, ''))) > 0
      )
    )
  GROUP BY s.brand, s.template_id
  ORDER BY average_score DESC, s.brand, s.template_id
$$;

REVOKE ALL ON FUNCTION public.audit_store_template_summary(date, date, text[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_store_template_summary(date, date, text[])
  TO authenticated;

-- Atomically save one audit and all automatically generated concern tickets.
-- The function validates the JWT email and ignores caller-supplied timestamps.
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
BEGIN
  IF caller_email = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF lower(coalesce(p_submission ->> 'submitted_by_email', '')) <> caller_email
     AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Audit submitter must match the signed-in user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.audit_templates t
    WHERE t.id = p_submission ->> 'template_id'
      AND coalesce(t.is_active, true)
  ) THEN
    RAISE EXCEPTION 'The selected audit template is missing or inactive';
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
    'created_by', caller_email
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

-- Approve/reject in one transaction. This replaces the browser's previous
-- multi-step update/comment/SLA sequence and prevents partial approvals.
CREATE OR REPLACE FUNCTION public.process_ticket_approval(
  p_ticket_id text,
  p_action text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_email text := private.current_email();
  caller_profile jsonb := private.current_profile();
  current_ticket public.tickets;
  updated_ticket public.tickets;
  target_department_id text;
  target_department_name text;
  department_head_email text;
  department_head_name text;
  sla_policy public.slas;
  now_utc timestamptz := now();
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Action must be approve or reject';
  END IF;

  SELECT * INTO current_ticket FROM public.tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket not found'; END IF;

  IF NOT (
    private.is_admin()
    OR lower(coalesce(current_ticket.approver_email, '')) = caller_email
    OR (
      coalesce(caller_profile ->> 'user_type', '') = 'store_manager'
      AND private.manages_store(current_ticket.store_name)
    )
  ) THEN
    RAISE EXCEPTION 'You are not allowed to process this ticket';
  END IF;

  IF coalesce(current_ticket.approval_status, 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'This ticket has already been processed';
  END IF;

  IF p_action = 'reject' THEN
    IF nullif(trim(coalesce(p_rejection_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;

    UPDATE public.tickets
    SET approval_status = 'rejected', status = 'open',
        approver_email = caller_email,
        approver_name = coalesce(caller_profile ->> 'full_name', caller_email),
        approved_at = now_utc, rejection_reason = trim(p_rejection_reason),
        updated_date = now_utc
    WHERE id = p_ticket_id
    RETURNING * INTO updated_ticket;

    INSERT INTO public.ticket_comments (
      id, created_date, updated_date, ticket_id, content,
      author_email, author_name, is_internal, is_sample, created_by
    ) VALUES (
      gen_random_uuid()::text, now_utc, now_utc, p_ticket_id,
      'Ticket rejected by approver: ' || trim(p_rejection_reason),
      caller_email, coalesce(caller_profile ->> 'full_name', caller_email),
      false, false, caller_email
    );
  ELSE
    SELECT coalesce(c.department_id, current_ticket.handling_department_id, current_ticket.department_id)
    INTO target_department_id
    FROM (SELECT 1) AS seed
    LEFT JOIN public.categories c ON c.id = current_ticket.category_id;

    SELECT d.name INTO target_department_name
    FROM public.departments d WHERE d.id = target_department_id;

    SELECT u.email, coalesce(u.full_name, u.display_name, u.email)
    INTO department_head_email, department_head_name
    FROM public.users u
    WHERE u.department_id = target_department_id
      AND u.user_type IN ('department_head', 'admin')
      AND coalesce(u.disabled, false) = false
    ORDER BY (u.user_type = 'department_head') DESC, u.created_date
    LIMIT 1;

    UPDATE public.tickets
    SET approval_status = 'approved', status = 'open',
        approver_email = caller_email,
        approver_name = coalesce(caller_profile ->> 'full_name', caller_email),
        approved_at = now_utc,
        assigned_to = department_head_email,
        handling_department_id = target_department_id,
        handling_department_name = coalesce(target_department_name, current_ticket.handling_department_name, current_ticket.department_name),
        rejection_reason = NULL,
        updated_date = now_utc
    WHERE id = p_ticket_id
    RETURNING * INTO updated_ticket;

    SELECT policy.* INTO sla_policy
    FROM public.slas policy
    WHERE coalesce(policy.is_active, true)
      AND policy.priority = coalesce(updated_ticket.priority, 'medium')
      AND (policy.department_id IS NULL OR policy.department_id = target_department_id)
    ORDER BY (policy.department_id IS NOT NULL) DESC, policy.created_date DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.tickets
      SET sla_id = sla_policy.id,
          sla_response_due = now_utc + make_interval(hours => coalesce(sla_policy.response_time_hours, 0)),
          sla_resolution_due = now_utc + make_interval(hours => coalesce(sla_policy.resolution_time_hours, 0)),
          sla_response_breached = false,
          sla_resolution_breached = false,
          updated_date = now_utc
      WHERE id = p_ticket_id
      RETURNING * INTO updated_ticket;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    id, created_date, updated_date, user_email, ticket_id,
    type, title, message, link, is_read, is_sample, created_by
  )
  SELECT gen_random_uuid()::text, now_utc, now_utc, recipient.email, p_ticket_id,
         CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
         'Ticket ' || CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
         CASE WHEN p_action = 'approve'
              THEN 'Ticket "' || coalesce(updated_ticket.title, p_ticket_id) || '" was approved.'
              ELSE 'Ticket "' || coalesce(updated_ticket.title, p_ticket_id) || '" was rejected: ' || trim(p_rejection_reason)
         END,
         '/ticket/' || p_ticket_id, false, false, caller_email
  FROM (
    SELECT lower(updated_ticket.submitter_email) AS email
    UNION
    SELECT lower(updated_ticket.assigned_to) WHERE updated_ticket.assigned_to IS NOT NULL
  ) AS recipient
  WHERE recipient.email IS NOT NULL AND recipient.email <> '';

  RETURN updated_ticket;
END;
$$;

REVOKE ALL ON FUNCTION public.process_ticket_approval(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_ticket_approval(text, text, text) TO authenticated;

COMMIT;

-- Verification summary.
SELECT
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'audit_submissions_%') AS audit_indexes,
  (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('list_audit_submissions', 'audit_store_template_summary', 'submit_audit_bundle', 'process_ticket_approval')) AS scaling_functions,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pending_users' AND column_name = 'password') AS plaintext_password_columns;
