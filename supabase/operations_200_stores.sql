-- FCG HelpDesk: read-only production health checks for 200 stores
-- Run individual sections in the Supabase SQL Editor. Nothing in this file
-- inserts, updates, or deletes application data.

-- 1. Daily audit volume and average score for the last 30 days.
SELECT
  (coalesce(submission_date, created_date) AT TIME ZONE 'Asia/Manila')::date AS audit_day,
  count(*) AS audits,
  round(avg(score), 2) AS average_score
FROM public.audit_submissions
WHERE coalesce(submission_date, created_date) >= now() - interval '30 days'
  AND archived_at IS NULL
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Growth and approximate database size by high-volume table.
SELECT
  table_name,
  pg_size_pretty(pg_total_relation_size(format('public.%I', table_name)::regclass)) AS total_size,
  CASE table_name
    WHEN 'audit_submissions' THEN (SELECT count(*) FROM public.audit_submissions)
    WHEN 'tickets' THEN (SELECT count(*) FROM public.tickets)
    WHEN 'ticket_comments' THEN (SELECT count(*) FROM public.ticket_comments)
    WHEN 'notifications' THEN (SELECT count(*) FROM public.notifications)
  END AS rows
FROM unnest(ARRAY[
  'audit_submissions', 'tickets', 'ticket_comments', 'notifications'
]) AS monitored(table_name)
ORDER BY pg_total_relation_size(format('public.%I', table_name)::regclass) DESC;

-- 3. Large audit JSON rows that deserve investigation or image cleanup.
SELECT
  id,
  template_title,
  brand,
  submission_date,
  pg_column_size(audit_submissions) AS row_bytes
FROM public.audit_submissions
WHERE archived_at IS NULL
ORDER BY pg_column_size(audit_submissions) DESC
LIMIT 25;

-- 4. Legacy base64 signatures. New submissions should store Storage URLs.
SELECT
  count(*) FILTER (WHERE signature1_photo_url LIKE 'data:%') AS signature_1_base64,
  count(*) FILTER (WHERE signature2_photo_url LIKE 'data:%') AS signature_2_base64
FROM public.audit_submissions;

-- 5. Operational queues and overdue SLA work.
SELECT
  count(*) FILTER (WHERE approval_status = 'pending') AS pending_approvals,
  count(*) FILTER (
    WHERE status NOT IN ('resolved', 'closed')
      AND sla_response_due < now()
      AND first_response_at IS NULL
  ) AS overdue_first_responses,
  count(*) FILTER (
    WHERE status NOT IN ('resolved', 'closed')
      AND sla_resolution_due < now()
  ) AS overdue_resolutions
FROM public.tickets;

-- 6. Verify the scaling migration is installed.
SELECT
  (SELECT count(*)
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN (
       'list_audit_submissions',
       'audit_store_template_summary',
       'submit_audit_bundle',
       'process_ticket_approval'
     )) AS scaling_functions,
  (SELECT count(*)
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'pending_users'
     AND column_name = 'password') AS plaintext_password_columns;
