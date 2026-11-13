-- Which days each store is open, for checklist completion — set in
-- Admin › Stores. ISO weekday numbers: 1 = Monday … 7 = Sunday, e.g.
-- {1,2,3,4,5} for a store open Monday to Friday. NULL — every store until
-- it's set — means open every day. On a day the store is closed no
-- checklist is due, so the Audit Dashboard and Daily Summary show it as
-- closed instead of missed, and it doesn't lower the store's completion.
--
-- Run this before deploying the matching app update.

BEGIN;

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS open_days smallint[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_open_days_check') THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_open_days_check CHECK (
        open_days IS NULL
        OR (cardinality(open_days) BETWEEN 1 AND 7 AND open_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[])
      );
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
