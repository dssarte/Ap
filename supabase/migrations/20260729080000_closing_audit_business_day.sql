-- Apply a 5:00 AM Asia/Manila business-day cutoff to Closing audits.
--
-- Closing Jul 29 04:00 -> Jul 28 business date
-- Closing Jul 28 23:00 -> Jul 28 business date
-- Closing Jul 29 05:00 -> Jul 29 business date
--
-- Other audit types continue to use their normal calendar date.

BEGIN;

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
    AND (p_date_from IS NULL OR audit_day.business_date >= p_date_from)
    AND (p_date_to IS NULL OR audit_day.business_date <= p_date_to)
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

-- Verification report. Check the business_date column after running.
SELECT
  template_title,
  brand,
  coalesce(submission_date, created_date) AS submitted_at,
  (
    (coalesce(submission_date, created_date) AT TIME ZONE 'Asia/Manila')
    - CASE
        WHEN position('CLOSING' IN upper(coalesce(template_title, ''))) > 0
         AND (coalesce(submission_date, created_date) AT TIME ZONE 'Asia/Manila')::time < time '05:00:00'
        THEN interval '1 day'
        ELSE interval '0 days'
      END
  )::date AS business_date
FROM public.audit_submissions
WHERE position('CLOSING' IN upper(coalesce(template_title, ''))) > 0
ORDER BY coalesce(submission_date, created_date) DESC
LIMIT 20;
