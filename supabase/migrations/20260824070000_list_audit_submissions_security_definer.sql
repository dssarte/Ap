-- list_audit_submissions was SECURITY INVOKER, so row-level security on
-- audit_submissions still ran underneath it — meaning every row paid for
-- BOTH this function's own p_store_names filter AND the RLS policy's
-- can_access_audit() check, each doing a non-indexable substring match.
-- That's more per-row work than the original unscoped query, not less,
-- which is why it can still time out even though the app now sends a
-- properly store-scoped request.
--
-- Fix: make the function SECURITY DEFINER so RLS no longer applies inside
-- it, and call private.can_access_audit() explicitly as the one and only
-- authorization gate — the exact same function RLS itself uses, so who can
-- see what is unchanged. p_store_names remains as an optional extra filter
-- for narrowing to a single store in the UI; it is no longer a security
-- boundary since can_access_audit() is now what actually gates access.

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
SECURITY DEFINER
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
    AND private.can_access_audit(s.brand, s.submitted_by_email)
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

COMMIT;
