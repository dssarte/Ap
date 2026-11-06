-- NO findings per checklist item, for one checklist: how many times each of
-- its items was answered NO in range. The Audit Dashboard adds the items up
-- by the checklist's sections for its "NO Findings by Category" pie.
-- The rows, access rules and filters are audit_dashboard_summary's —
-- Corporate / Franchise split included — so the two charts agree.
--
-- Run this before deploying the matching app update.

BEGIN;

CREATE OR REPLACE FUNCTION public.audit_no_findings_by_item(
  p_template_id text,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_store_name text DEFAULT NULL,
  p_ownership text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH viewer AS MATERIALIZED (
  SELECT * FROM private.audit_viewer()
),
-- This checklist's audits in range that the viewer may see — only those
-- with a NO, since the rest add nothing here.
in_scope AS MATERIALIZED (
  SELECT s.brand, s.answers
  FROM public.audit_submissions s
  WHERE s.template_id = p_template_id
    AND s.archived_at IS NULL
    AND NOT coalesce(s.is_draft, false)
    AND s.score IS NOT NULL
    AND coalesce(s.no_count, 0) > 0
    AND (
      (SELECT sees_all FROM viewer)
      OR (NOT (SELECT is_manager FROM viewer) AND lower(coalesce(s.submitted_by_email, '')) = (SELECT email FROM viewer))
      OR EXISTS (
        SELECT 1 FROM unnest((SELECT stores FROM viewer)) AS mine(store)
        WHERE position(mine.store IN lower(coalesce(s.brand, ''))) > 0
      )
    )
    AND (p_date_from IS NULL OR s.business_date >= p_date_from)
    AND (p_date_to IS NULL OR s.business_date <= p_date_to)
    AND (p_brand_name IS NULL OR s.brand ILIKE p_brand_name || '%')
    AND (p_store_name IS NULL OR s.brand ILIKE '%' || p_store_name || '%')
),
-- Store labels that are a franchise store's: its "Brand - Store", or that
-- plus ", location". Checked once per label, as in the summary.
franchise_brands AS MATERIALIZED (
  SELECT b.brand
  FROM (SELECT DISTINCT brand FROM in_scope) AS b
  WHERE p_ownership IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.stores st
      WHERE st.ownership = 'franchise'
        AND (
          lower(b.brand) = lower(st.brand_name || ' - ' || st.store_name)
          OR starts_with(lower(b.brand), lower(st.brand_name || ' - ' || st.store_name) || ',')
        )
    )
),
scoped AS (
  SELECT answers
  FROM in_scope
  WHERE p_ownership IS NULL
    OR p_ownership = CASE WHEN brand IN (SELECT fb.brand FROM franchise_brands AS fb) THEN 'franchise' ELSE 'corporate' END
),
item_counts AS (
  SELECT answer.key AS item_id, count(*) AS times
  FROM scoped
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(scoped.answers) = 'object' THEN scoped.answers ELSE '{}'::jsonb END
  ) AS answer(key, value)
  WHERE upper(trim(answer.value)) = 'NO'
  GROUP BY answer.key
)
SELECT coalesce(
  jsonb_agg(jsonb_build_object('item', item_id, 'no', times) ORDER BY times DESC, item_id),
  '[]'::jsonb
)
FROM item_counts
$$;

REVOKE ALL ON FUNCTION public.audit_no_findings_by_item(text, date, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_no_findings_by_item(text, date, date, text, text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
