-- 1. Stores are corporate (company-owned) or franchise. Every store that
--    exists today is corporate; franchise stores are tagged as they're added
--    (first batch: Angels Pizza, Figaro Coffee and Angels Pizza Express,
--    Nov 2026). The Audit Dashboard reports them separately, so
--    audit_dashboard_summary gains p_ownership ('corporate' | 'franchise' |
--    NULL for all). A new parameter changes its signature, so the old one is
--    dropped first (two versions would make API calls ambiguous) and its
--    grants restored.
-- 2. Long date ranges timed out: list_audit_submissions and
--    audit_dashboard_summary looked up the caller's profile once per row
--    (private.can_access_audit). Both now work out access once per query via
--    private.audit_viewer(), with the same rules. The summary's per-store
--    and per-checklist figures are also worked out once — inside a function
--    the planner guessed one row and redid them for every store.
--    (Sep 1 – Nov 4 on a 47k-row test copy: ~55 s before, ~0.25 s after.)
-- 3. audit_completion_days returns checklist completion already grouped,
--    instead of the dashboard paging through every submission in range.
--
-- Run this before deploying the matching app update.

BEGIN;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS ownership text NOT NULL DEFAULT 'corporate';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_ownership_check') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_ownership_check CHECK (ownership IN ('corporate', 'franchise'));
  END IF;
END $$;

-- What the signed-in user may see of audit_submissions — the same rules as
-- private.can_access_audit, worked out once per query instead of once per
-- row (that per-row profile lookup is what made long ranges time out).
CREATE OR REPLACE FUNCTION private.audit_viewer()
RETURNS TABLE (sees_all boolean, is_manager boolean, email text, stores text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH profile AS (SELECT private.current_profile() AS p)
  SELECT
    coalesce(p ->> 'user_type', '') <> 'store_manager'
      AND (
        coalesce(p ->> 'user_type', '') IN ('admin', 'director')
        OR lower(coalesce(p ->> 'department_name', '')) = 'quality assurance'
      ),
    coalesce(p ->> 'user_type', '') = 'store_manager',
    private.current_email(),
    CASE
      WHEN coalesce(p ->> 'user_type', '') = 'store_manager' THEN ARRAY(
        SELECT lower(trim(assigned.store_name))
        FROM jsonb_array_elements_text(coalesce(p -> 'assigned_stores', '[]'::jsonb)) AS assigned(store_name)
        WHERE trim(assigned.store_name) <> ''
      )
      ELSE ARRAY(
        SELECT lower(p ->> 'store_name')
        WHERE nullif(coalesce(p ->> 'store_name', ''), '') IS NOT NULL
      )
    END
  FROM profile
$$;

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
  WITH viewer AS MATERIALIZED (SELECT * FROM private.audit_viewer())
  SELECT s.*
  FROM public.audit_submissions AS s
  WHERE s.archived_at IS NULL
    AND NOT coalesce(s.is_draft, false)
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

DROP FUNCTION IF EXISTS public.audit_dashboard_summary(date, date, text, text, text[]);

CREATE OR REPLACE FUNCTION public.audit_dashboard_summary(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_store_name text DEFAULT NULL,
  p_template_ids text[] DEFAULT NULL,
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
-- What the viewer may see in range, before the Corporate / Franchise split.
in_scope AS MATERIALIZED (
  SELECT
    s.id,
    s.brand,
    s.template_id,
    s.template_title,
    s.score::numeric AS score,
    coalesce(s.no_count, 0) AS no_count,
    s.business_date,
    (position('OD CHECKLIST' IN upper(coalesce(s.template_title, ''))) > 0) AS is_od
  FROM public.audit_submissions s
  WHERE s.archived_at IS NULL
    AND NOT coalesce(s.is_draft, false)
    AND s.score IS NOT NULL
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
    AND (p_template_ids IS NULL OR s.template_id = ANY(p_template_ids))
    AND (p_brand_name IS NULL OR s.brand ILIKE p_brand_name || '%')
    AND (p_store_name IS NULL OR s.brand ILIKE '%' || p_store_name || '%')
),
-- Store labels in range that are a franchise store's: its "Brand - Store",
-- or that plus ", location". Checked once per label, not per submission.
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
scoped AS MATERIALIZED (
  SELECT *
  FROM in_scope
  WHERE p_ownership IS NULL
    OR p_ownership = CASE WHEN brand IN (SELECT fb.brand FROM franchise_brands AS fb) THEN 'franchise' ELSE 'corporate' END
),
scoped_tickets AS (
  SELECT t.id, t.audit_submission_id, t.audit_template_id, sc.business_date
  FROM public.tickets t
  JOIN scoped sc ON sc.id = t.audit_submission_id
  WHERE t.audit_submission_id IS NOT NULL
    AND private.can_access_ticket(t.id)
),

overall_stats AS (
  SELECT jsonb_build_object(
    'total', count(*),
    'avg', avg(score),
    'passing', count(*) FILTER (WHERE score >= 95),
    'failing', count(*) FILTER (WHERE score < 95),
    'stores', count(DISTINCT brand),
    'templatesUsed', count(DISTINCT template_id),
    'tickets', (SELECT count(*) FROM scoped_tickets)
  ) AS stats
  FROM scoped
),

-- The CTEs on the right of a join are MATERIALIZED (worked out once). Inside
-- a function the planner can't see the date range, guesses `scoped` is one
-- row, and would otherwise rerun them for every row on the left — over 5
-- seconds at two months of submissions.
template_ticket_counts AS MATERIALIZED (
  SELECT audit_template_id, count(*) AS tickets
  FROM scoped_tickets
  GROUP BY audit_template_id
),
template_agg AS (
  SELECT
    sc.template_id AS id,
    max(sc.template_title) AS title,
    avg(sc.score) AS avg,
    count(*) AS audits,
    count(*) FILTER (WHERE sc.score >= 95) AS passing,
    count(*) FILTER (WHERE sc.score < 95) AS failing,
    sum(sc.no_count) AS no_findings,
    coalesce(max(ttc.tickets), 0) AS tickets
  FROM scoped sc
  LEFT JOIN template_ticket_counts ttc ON ttc.audit_template_id = sc.template_id
  GROUP BY sc.template_id
),
template_rows AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id, 'title', title, 'avg', avg,
      'audits', audits, 'passing', passing, 'failing', failing,
      'passRate', CASE WHEN audits > 0 THEN passing::numeric / audits * 100 ELSE 0 END,
      'noFindings', no_findings, 'tickets', tickets
    )
    ORDER BY avg DESC NULLS LAST, audits DESC, title ASC
  ) AS rows
  FROM template_agg
),

day_ticket_counts AS MATERIALIZED (
  SELECT business_date, count(*) AS tickets
  FROM scoped_tickets
  GROUP BY business_date
),
day_agg AS (
  SELECT
    sc.business_date AS day,
    avg(sc.score) AS avg,
    count(*) AS audits,
    count(*) FILTER (WHERE sc.score >= 95) AS passing,
    count(*) FILTER (WHERE sc.score < 95) AS failing,
    sum(sc.no_count) AS no_findings,
    coalesce(max(dtc.tickets), 0) AS tickets
  FROM scoped sc
  LEFT JOIN day_ticket_counts dtc ON dtc.business_date = sc.business_date
  GROUP BY sc.business_date
),
daily_rows AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day', to_char(day, 'YYYY-MM-DD'),
      'label', to_char(day, 'Mon DD'),
      'avg', avg, 'audits', audits, 'passing', passing, 'failing', failing,
      'noFindings', no_findings, 'tickets', tickets
    )
    ORDER BY day ASC
  ) AS rows
  FROM day_agg
),

month_overall AS (
  SELECT
    date_trunc('month', business_date)::date AS month_start,
    to_char(business_date, 'Mon YYYY') AS label,
    NULL::text AS template_id,
    'Overall'::text AS title,
    avg(score) AS avg
  FROM scoped
  GROUP BY date_trunc('month', business_date), to_char(business_date, 'Mon YYYY')
),
month_per_template AS (
  SELECT
    date_trunc('month', business_date)::date AS month_start,
    to_char(business_date, 'Mon YYYY') AS label,
    template_id,
    max(template_title) AS title,
    avg(score) AS avg
  FROM scoped
  GROUP BY date_trunc('month', business_date), to_char(business_date, 'Mon YYYY'), template_id
),
trend_data AS (
  SELECT jsonb_agg(
    jsonb_build_object('month', label, 'templateId', template_id, 'title', title, 'avg', avg)
    ORDER BY month_start ASC, title ASC
  ) AS rows
  FROM (SELECT * FROM month_overall UNION ALL SELECT * FROM month_per_template) combined
),

non_od_ranked AS (
  SELECT
    brand, score,
    row_number() OVER (PARTITION BY brand ORDER BY business_date DESC, id DESC) AS rn,
    count(*) OVER (PARTITION BY brand) AS cnt
  FROM scoped
  WHERE NOT is_od
),
store_trend AS MATERIALIZED (
  SELECT
    brand,
    avg(score) AS avg,
    avg(score) FILTER (WHERE rn <= floor(cnt / 2.0)) AS early_avg,
    avg(score) FILTER (WHERE rn > floor(cnt / 2.0)) AS late_avg
  FROM non_od_ranked
  GROUP BY brand
),
store_template_agg AS MATERIALIZED (
  SELECT brand, jsonb_agg(jsonb_build_object('title', title, 'avg', avg) ORDER BY title) AS template_scores
  FROM (
    SELECT brand, max(template_title) AS title, avg(score) AS avg
    FROM scoped
    GROUP BY brand, template_id
  ) per_store_template
  GROUP BY brand
),
store_counts AS (
  SELECT brand, count(*) AS cnt FROM scoped GROUP BY brand
),
store_rows AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'store', sc.brand,
      'avg', st.avg,
      'trend', coalesce(st.late_avg, st.avg) - coalesce(st.early_avg, st.avg),
      'count', sc.cnt,
      'templateScores', coalesce(sta.template_scores, '[]'::jsonb),
      'isPassing', CASE WHEN st.avg IS NULL THEN NULL ELSE st.avg >= 95 END
    )
    ORDER BY st.avg DESC NULLS LAST
  ) AS rows
  FROM store_counts sc
  LEFT JOIN store_trend st ON st.brand = sc.brand
  LEFT JOIN store_template_agg sta ON sta.brand = sc.brand
)

SELECT jsonb_build_object(
  'stats', (SELECT stats FROM overall_stats),
  'templateRows', coalesce((SELECT rows FROM template_rows), '[]'::jsonb),
  'dailyRows', coalesce((SELECT rows FROM daily_rows), '[]'::jsonb),
  'trendData', coalesce((SELECT rows FROM trend_data), '[]'::jsonb),
  'storeRows', coalesce((SELECT rows FROM store_rows), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.audit_dashboard_summary(date, date, text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_dashboard_summary(date, date, text, text, text[], text) TO authenticated;

-- Checklist completion for the Audit Dashboard: for each store label and
-- checklist, the business days it was done, as day offsets from p_date_from
-- — one small JSON result instead of every submission in range.
CREATE OR REPLACE FUNCTION public.audit_completion_days(
  p_date_from date,
  p_date_to date,
  p_template_ids text[] DEFAULT NULL,
  p_store_names text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS MATERIALIZED (SELECT * FROM private.audit_viewer()),
  done AS (
    SELECT s.brand AS label, s.template_id, array_agg(DISTINCT s.business_date - p_date_from ORDER BY s.business_date - p_date_from) AS days
    FROM public.audit_submissions AS s
    WHERE s.archived_at IS NULL
      AND NOT coalesce(s.is_draft, false)
      AND s.business_date BETWEEN p_date_from AND p_date_to
      AND (p_template_ids IS NULL OR s.template_id = ANY(p_template_ids))
      AND (
        p_store_names IS NULL
        OR EXISTS (
          SELECT 1 FROM unnest(p_store_names) AS requested(store_name)
          WHERE position(lower(requested.store_name) IN lower(coalesce(s.brand, ''))) > 0
        )
      )
      AND (
        (SELECT sees_all FROM viewer)
        OR (NOT (SELECT is_manager FROM viewer) AND lower(coalesce(s.submitted_by_email, '')) = (SELECT email FROM viewer))
        OR EXISTS (
          SELECT 1 FROM unnest((SELECT stores FROM viewer)) AS mine(store)
          WHERE position(mine.store IN lower(coalesce(s.brand, ''))) > 0
        )
      )
    GROUP BY s.brand, s.template_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('label', label, 'template_id', template_id, 'days', days)), '[]'::jsonb)
  FROM done
$$;

REVOKE ALL ON FUNCTION public.audit_completion_days(date, date, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_completion_days(date, date, text[], text[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
