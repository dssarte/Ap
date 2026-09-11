-- Same root cause and same fix as 20260824070000_list_audit_submissions_security_definer.sql:
-- audit_store_template_summary was SECURITY INVOKER, so RLS's
-- can_access_audit() check on audit_submissions still ran underneath it on
-- every row scanned. As the table has grown, this now times out
-- (57014 canceling statement due to statement timeout) for regular
-- authenticated users (e.g. QA department accounts) even though the same
-- query returns instantly for a superuser session that bypasses RLS.
--
-- Fix: make it SECURITY DEFINER and call private.can_access_audit()
-- explicitly as the one and only authorization gate — the exact same
-- function RLS itself uses, so who can see what is unchanged.

BEGIN;

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
SECURITY DEFINER
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
  CROSS JOIN LATERAL (
    SELECT (
      (coalesce(s.submission_date, s.created_date) AT TIME ZONE 'Asia/Manila')
      - CASE
          WHEN position('CLOSING' IN upper(coalesce(s.template_title, ''))) > 0
           AND (coalesce(s.submission_date, s.created_date) AT TIME ZONE 'Asia/Manila')::time < time '05:00:00'
          THEN interval '1 day'
          ELSE interval '0 days'
        END
    )::date AS business_date
  ) AS audit_day
  WHERE s.archived_at IS NULL
    AND s.score IS NOT NULL
    AND private.can_access_audit(s.brand, s.submitted_by_email)
    AND (p_date_from IS NULL OR audit_day.business_date >= p_date_from)
    AND (p_date_to IS NULL OR audit_day.business_date <= p_date_to)
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

COMMIT;
