-- Audit Dashboard times out querying a month of data across all brands.
-- Unlike QA Dashboard/Store Ranking, it genuinely needs every template (not
-- just QA ones), so the earlier p_template_ids fix doesn't help here — a
-- month across every store's daily Opening/OD/Mid/Closing checklists plus
-- QA ones is genuinely a lot of rows, often needing several 1000-row pages.
--
-- The real remaining cost is that auditData.listSubmissions() (base44Client)
-- paginates with OFFSET: every page re-evaluates private.can_access_audit()
-- for every row the previous pages already returned, so total work across
-- all pages grows with roughly the square of the page count — this is the
-- same class of problem fixed for tickets/entity pagination earlier, just
-- never applied to this RPC's own internal pagination.
--
-- Adding a keyset cursor (p_before_date/p_before_id) lets the client ask for
-- "rows after the last one I saw" instead of "skip N rows", so each row's
-- access check is paid exactly once across the whole paginated fetch,
-- however many pages it takes. p_offset is kept for backward compatibility
-- but the client now uses the cursor for page 2+.
DROP FUNCTION IF EXISTS public.list_audit_submissions(date, date, text[], text, text[], integer, integer);

CREATE OR REPLACE FUNCTION public.list_audit_submissions(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_store_names text[] DEFAULT NULL,
  p_template_id text DEFAULT NULL,
  p_template_ids text[] DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0,
  p_before_date timestamptz DEFAULT NULL,
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
      OR coalesce(s.submission_date, s.created_date) < p_before_date
      OR (coalesce(s.submission_date, s.created_date) = p_before_date AND s.id < p_before_id)
    )
  ORDER BY coalesce(s.submission_date, s.created_date) DESC, s.id DESC
  LIMIT least(greatest(coalesce(p_limit, 1000), 1), 5000)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;

REVOKE ALL ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_audit_submissions(date, date, text[], text, text[], integer, integer, timestamptz, text) TO authenticated;
