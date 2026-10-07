-- Warehouses, as audit targets, following the same pattern established for
-- Mayon Building (head office): a `stores` row with a non-'store' `kind`,
-- under its own brand bucket so Conduct Audit's existing brand/store
-- picker and store_restrictions work completely unchanged.
--
-- "Mayon Warehouse" here is deliberately a SEPARATE facility from "Mayon
-- Building" (kind='head_office', added earlier) — same general site, but
-- a distinct building/operation being audited under a different
-- checklist, not the same room-by-room housekeeping walkthrough.
INSERT INTO public.brands (id, brand_name, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, 'Warehouses', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE brand_name = 'Warehouses');

INSERT INTO public.stores (id, store_name, brand_id, location, kind, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, v.store_name, b.id, NULL, 'warehouse', true, now(), now()
FROM public.brands b
CROSS JOIN (VALUES
  ('Tarlac Warehouse'),
  ('Mayon Warehouse'),
  ('Consolacion Warehouse'),
  ('CDO Warehouse')
) AS v(store_name)
WHERE b.brand_name = 'Warehouses'
  AND NOT EXISTS (SELECT 1 FROM public.stores WHERE store_name = v.store_name);
