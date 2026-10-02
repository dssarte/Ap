-- Still timing out after the schema-cache fix and the can_access_audit
-- optimization, even on a single page. Root cause: the WHERE clause filters
-- on business_date (indexed), but ORDER BY used a DIFFERENT expression
-- (coalesce(submission_date, created_date)). Postgres can't satisfy a filter
-- on one column and a sort on another from the same index, so it has to
-- materialize and sort the ENTIRE matching set before LIMIT ever applies —
-- meaning can_access_audit() runs on every matching row regardless of page
-- size, and LIMIT can't short-circuit the scan at all.
--
-- Sorting by business_date instead (same column the WHERE/index use) lets
-- Postgres do a single index-ordered scan and stop as soon as it has
-- p_limit accessible rows — the normal, fast path. id is now the sole
-- tiebreaker within a business_date (unique, so still fully deterministic);
-- the within-day chronological ordering by exact timestamp is dropped,
-- which only affects display order for submissions made on the same
-- business day, not any filtering or correctness.
DROP FUNCTION IF EXISTS public.list_audit_submissions(date, date, text[], text, text[], integer, integer, timestamptz, text);

CREATE OR REPLACE FUNCTION public.list_audit_submissions(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store_names text[] DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_template_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0,
  p_before_date date DEFAULT NULL,
  p_before_id text DEFAULT NULL
)
RETURNS SETOF public.audit_submissions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.*
  FROM public.audit_submissions AS s
  WHERE s.archived_at IS NULL
    AND private.can_access_audit(s.brand, s.submitted_by_email)
    AND (p_date_from IS NULL OR s.business_date >= p_date_from)
    AND (p_date_to IS NULL OR s.business_date <= p_date_to)
    AND (p_template_id IS NULL OR s.template_id = p_template_id)
    AND (p_template_ids IS NULL OR s.template_id = ANY(p_template_ids))
    AND (
      p_store_names IS NULL
      OR EXISTS (
        SELECT 1
        FROM unnest(p_store_names) AS requested(store_name)
        WHERE position(lower(requested.store_name) IN lower(coalesce(s.brand, ''))) > 0
      )
    )
    AND (
      p_before_date IS NULL
      OR s.business_date < p_before_date
      OR (s.business_date = p_before_date AND s.id < p_before_id)
    )
  ORDER BY s.business_date DESC, s.id DESC
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer, date, text) TO authenticated;
