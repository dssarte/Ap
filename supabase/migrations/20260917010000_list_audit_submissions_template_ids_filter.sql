-- QA Dashboard (and Store Ranking) only ever need the handful of QA
-- checklist templates, but list_audit_submissions had no way to filter by
-- more than one template_id at a time — every call fetched ALL audit
-- submissions in the date range (every store's daily Opening/OD/Mid/Closing
-- checklist included), then filtered down to just the QA ones client-side.
-- That's the overwhelming majority of audit volume for no reason: QA
-- checklists happen a handful of times a month per store, while the
-- operational ones happen multiple times a DAY per store. Widening the date
-- range past ~10 days pulled in enough extra rows (each still paying the
-- per-row private.can_access_audit() check) to blow the statement timeout.
--
-- Adding p_template_ids lets the two callers that only care about QA
-- checklists filter at the database boundary instead, cutting the actual
-- row count scanned/paginated by roughly an order of magnitude for the same
-- date range.
DROP FUNCTION IF EXISTS public.list_audit_submissions(date, date, text[], text, integer, integer);

CREATE OR REPLACE FUNCTION public.list_audit_submissions(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store_names text[] DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_template_ids text[] DEFAULT NULL,
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
  ORDER BY coalesce(s.submission_date, s.created_date) DESC
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer) TO authenticated;
