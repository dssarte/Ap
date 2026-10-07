-- Foundation for non-store checklists (head office, warehouses,
-- commissaries, ...). Everything so far (Conduct Audit's brand/store
-- picker, store_restrictions, RLS) is keyed off a real row in `stores` — so
-- rather than building a parallel system, `stores` grows a `kind` column
-- (default 'store', so every existing row is unaffected) and a facility is
-- just another row with a different kind. This reuses store_restrictions,
-- can_access_audit, and the whole Conduct Audit flow unchanged.
--
-- Two new submission-level fields, generic (not Mayon-specific), opt-in per
-- template exactly like requires_audit_type/requires_visit_number:
--   - audit_templates.requires_commitment_date ("Ask Commitment Date")
--   - audit_submissions.commitment_date (the date entered when asked)
--
-- NOTE: this only adds columns this app's own code is known to read/write.
-- If this INSERT errors on a NOT NULL constraint for some other column on
-- `stores`/`brands` that isn't listed here, that's a column outside what's
-- visible from the frontend — paste the exact error back and it's a
-- one-line fix.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'store';

ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS requires_commitment_date boolean NOT NULL DEFAULT false;

ALTER TABLE public.audit_submissions
  ADD COLUMN IF NOT EXISTS commitment_date date;

-- "Head Office" brand bucket — lets the existing Brand -> Store cascading
-- picker in Conduct Audit work completely unchanged for facility checklists.
INSERT INTO public.brands (id, brand_name, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, 'Head Office', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE brand_name = 'Head Office');

-- Mayon Building — the first facility. `location` intentionally left blank;
-- fill it in via the Store entity if you want an address shown alongside it
-- the way store locations are.
INSERT INTO public.stores (id, store_name, brand_id, location, kind, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, 'Mayon Building', b.id, NULL, 'head_office', true, now(), now()
FROM public.brands b
WHERE b.brand_name = 'Head Office'
  AND NOT EXISTS (SELECT 1 FROM public.stores WHERE store_name = 'Mayon Building');
