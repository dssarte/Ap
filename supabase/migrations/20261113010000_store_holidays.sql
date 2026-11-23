-- Holidays and other one-off closures — set by admins in Administration ›
-- Holidays: a name, the date (or a run of dates) and which stores close —
-- every store, or the ones picked (by id, so a rename doesn't lose them).
-- On a store's holiday no checklist is due: the Audit Dashboard and Daily
-- Summary show the day as a holiday and leave it out of the store's
-- completion, the same as a day the store doesn't open.
--
-- Everyone signed in can read holidays (the dashboards need them); only
-- admins can add, change or remove them.
--
-- Run this before deploying the matching app update.

BEGIN;

CREATE TABLE IF NOT EXISTS public.store_holidays (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  all_stores boolean NOT NULL DEFAULT true,
  store_ids text[] NOT NULL DEFAULT '{}',
  created_by text,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_holidays_name_check CHECK (length(trim(name)) > 0),
  CONSTRAINT store_holidays_dates_check CHECK (date_to >= date_from AND date_to - date_from <= 366),
  CONSTRAINT store_holidays_stores_check CHECK (all_stores OR cardinality(store_ids) > 0)
);

CREATE INDEX IF NOT EXISTS store_holidays_dates_idx ON public.store_holidays (date_from, date_to);

ALTER TABLE public.store_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_holidays_read ON public.store_holidays;
CREATE POLICY store_holidays_read ON public.store_holidays
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS store_holidays_admin_insert ON public.store_holidays;
CREATE POLICY store_holidays_admin_insert ON public.store_holidays
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS store_holidays_admin_update ON public.store_holidays;
CREATE POLICY store_holidays_admin_update ON public.store_holidays
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS store_holidays_admin_delete ON public.store_holidays;
CREATE POLICY store_holidays_admin_delete ON public.store_holidays
FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

REVOKE ALL ON public.store_holidays FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_holidays TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
