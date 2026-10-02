-- Drafts (is_draft = true) are incomplete by definition — they must never
-- count toward Store Ranking, QA Dashboard, Audit Dashboard, or the "Done
-- for today" / History views. Both functions below query audit_submissions
-- directly (list_audit_submissions feeds most pages via base44.audit.
-- listSubmissions; audit_dashboard_summary queries the table itself, not
-- through that RPC, so it needs the same exclusion added separately).
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
    AND NOT coalesce(s.is_draft, false)
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
    AND NOT coalesce(s.is_draft, false)
    AND s.score IS NOT NULL
    AND private.can_access_audit(s.brand, s.submitted_by_email)
    AND (p_date_from IS NULL OR s.business_date >= p_date_from)
    AND (p_date_to IS NULL OR s.business_date <= p_date_to)
    AND (p_template_ids IS NULL OR s.template_id = ANY(p_template_ids))
    AND (p_brand_name IS NULL OR s.brand ILIKE p_brand_name || '%')
    AND (p_store_name IS NULL OR s.brand ILIKE '%' || p_store_name || '%')
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
