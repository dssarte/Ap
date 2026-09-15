-- list_audit_submissions is timing out (57014) again even though it's
-- already SECURITY DEFINER. The real cost is structural: it computes a
-- "business date" (closing checklists submitted before 5 AM count for the
-- previous day) via a CROSS JOIN LATERAL expression evaluated per row, and
-- ORDER BY coalesce(submission_date, created_date) is likewise a computed
-- expression — neither can use any existing index (all of which are on the
-- raw columns), so every call does a full sequential scan + full sort of
-- audit_submissions before LIMIT/OFFSET ever applies.
--
-- Fix: store business_date as an actual column (Postgres generated columns
-- can't use AT TIME ZONE — it's STABLE, not IMMUTABLE — so this is kept in
-- sync with a trigger instead), back-fill existing rows, index it, and add
-- a matching expression index for the ORDER BY so both the date-range
-- filter and the sort can use an index instead of recomputing per row.

ALTER TABLE public.audit_submissions ADD COLUMN IF NOT EXISTS business_date date;

CREATE OR REPLACE FUNCTION public.set_audit_submission_business_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.business_date := (
    (coalesce(NEW.submission_date, NEW.created_date, now()) AT TIME ZONE 'Asia/Manila')
    - CASE
        WHEN position('CLOSING' IN upper(coalesce(NEW.template_title, ''))) > 0
         AND (coalesce(NEW.submission_date, NEW.created_date, now()) AT TIME ZONE 'Asia/Manila')::time < time '05:00:00'
        THEN interval '1 day'
        ELSE interval '0 days'
      END
  )::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_submissions_set_business_date ON public.audit_submissions;
CREATE TRIGGER audit_submissions_set_business_date
  BEFORE INSERT OR UPDATE OF submission_date, created_date, template_title
  ON public.audit_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_submission_business_date();

-- Back-fill existing rows (same formula the trigger now maintains going forward).
UPDATE public.audit_submissions s
SET business_date = (
  (coalesce(s.submission_date, s.created_date) AT TIME ZONE 'Asia/Manila')
  - CASE
      WHEN position('CLOSING' IN upper(coalesce(s.template_title, ''))) > 0
       AND (coalesce(s.submission_date, s.created_date) AT TIME ZONE 'Asia/Manila')::time < time '05:00:00'
      THEN interval '1 day'
      ELSE interval '0 days'
    END
)::date
WHERE business_date IS NULL;

CREATE INDEX IF NOT EXISTS audit_submissions_business_date_idx
  ON public.audit_submissions (business_date DESC)
  WHERE archived_at IS NULL;

-- Matches the ORDER BY exactly, so an unfiltered/wide-range call can still
-- do an index-ordered scan with early LIMIT termination instead of sorting
-- every row.
CREATE INDEX IF NOT EXISTS audit_submissions_sort_date_idx
  ON public.audit_submissions ((coalesce(submission_date, created_date)) DESC)
  WHERE archived_at IS NULL;

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
  WHERE s.archived_at IS NULL
    AND private.can_access_audit(s.brand, s.submitted_by_email)
    AND (p_date_from IS NULL OR s.business_date >= p_date_from)
    AND (p_date_to IS NULL OR s.business_date <= p_date_to)
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

REVOKE ALL ON FUNCTION public.list_audit_submissions(date, date, text[], text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_audit_submissions(date, date, text[], text, integer, integer) TO authenticated;
