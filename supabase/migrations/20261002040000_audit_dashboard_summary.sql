-- Audit Dashboard's remaining timeout is genuine data volume: a month of
-- daily operational checklists (Opening/Mid/Closing) across every brand is
-- 7,500+ rows, each carrying a sizeable answers JSON payload — fetching all
-- of those to the browser just to reduce them into a handful of summary
-- numbers in JS is the actual bottleneck (confirmed via EXPLAIN ANALYZE: a
-- bare count() with zero RLS overhead already took 2.8s on heap I/O alone;
-- the real query also serializes and transfers every full row as JSON on
-- top of that).
--
-- This computes the dashboard's core aggregates (overall stats, per-
-- template performance, per-day trend, per-month trend, per-store
-- performance) inside Postgres via GROUP BY instead, returning a few
-- hundred summary rows instead of thousands of full ones. It mirrors the
-- exact computations AuditDashboard.jsx used to do client-side (same
-- PASS_THRESHOLD = 75, same OD-checklist exclusion rule for the per-store
-- average, same ticket-linkage rules) so the numbers it returns should
-- match what the page showed before — just computed where the data lives
-- instead of after shipping it to the browser.
CREATE OR REPLACE FUNCTION public.audit_dashboard_summary(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_brand_name text DEFAULT NULL,
  p_store_name text DEFAULT NULL,
  p_template_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
WITH scoped AS (
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
    AND s.score IS NOT NULL
    AND private.can_access_audit(s.brand, s.submitted_by_email)
    AND (p_date_from IS NULL OR s.business_date >= p_date_from)
    AND (p_date_to IS NULL OR s.business_date <= p_date_to)
    AND (p_template_ids IS NULL OR s.template_id = ANY(p_template_ids))
    AND (p_brand_name IS NULL OR s.brand ILIKE p_brand_name || '%')
    AND (p_store_name IS NULL OR s.brand ILIKE '%' || p_store_name || '%')
),
-- Concern tickets auto-generated from NO answers, scoped to this same
-- submission set and re-checked against the caller's own ticket access
-- (mirrors tickets_scoped_read — this function is SECURITY DEFINER, so
-- normal RLS doesn't apply automatically and has to be re-asserted here).
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
    'passing', count(*) FILTER (WHERE score >= 75),
    'failing', count(*) FILTER (WHERE score < 75),
    'stores', count(DISTINCT brand),
    'templatesUsed', count(DISTINCT template_id),
    'tickets', (SELECT count(*) FROM scoped_tickets)
  ) AS stats
  FROM scoped
),

template_ticket_counts AS (
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
    count(*) FILTER (WHERE sc.score >= 75) AS passing,
    count(*) FILTER (WHERE sc.score < 75) AS failing,
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

day_ticket_counts AS (
  SELECT business_date, count(*) AS tickets
  FROM scoped_tickets
  GROUP BY business_date
),
day_agg AS (
  SELECT
    sc.business_date AS day,
    avg(sc.score) AS avg,
    count(*) AS audits,
    count(*) FILTER (WHERE sc.score >= 75) AS passing,
    count(*) FILTER (WHERE sc.score < 75) AS failing,
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

-- Per-store average excludes OD checklists (operational, not a quality
-- metric) — same rule isOdChecklist() applied client-side before.
non_od_ranked AS (
  SELECT
    brand, score,
    row_number() OVER (PARTITION BY brand ORDER BY business_date DESC, id DESC) AS rn,
    count(*) OVER (PARTITION BY brand) AS cnt
  FROM scoped
  WHERE NOT is_od
),
store_trend AS (
  SELECT
    brand,
    avg(score) AS avg,
    avg(score) FILTER (WHERE rn <= floor(cnt / 2.0)) AS early_avg,
    avg(score) FILTER (WHERE rn > floor(cnt / 2.0)) AS late_avg
  FROM non_od_ranked
  GROUP BY brand
),
store_template_agg AS (
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
      'isPassing', CASE WHEN st.avg IS NULL THEN NULL ELSE st.avg >= 75 END
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

REVOKE ALL ON FUNCTION public.audit_dashboard_summary(date, date, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.audit_dashboard_summary(date, date, text, text, text[]) TO authenticated;
