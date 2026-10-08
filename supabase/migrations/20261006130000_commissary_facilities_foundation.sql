-- Commissary facilities, same pattern as Warehouses/Mayon Building: each
-- is a `stores` row with kind='commissary' under its own brand bucket, so
-- Conduct Audit's existing brand/store picker and store_restrictions work
-- unchanged. Angel's Pizza has two separate commissary buildings (one
-- general, one specifically in Consolacion) — confirmed as genuinely
-- distinct facilities per the user, even though their checklists turned
-- out to be byte-identical (handled as one shared template in the next
-- migration, same way the Mayon/Consolacion/CDO warehouses were).
INSERT INTO public.brands (id, brand_name, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, 'Commissaries', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE brand_name = 'Commissaries');

INSERT INTO public.stores (id, store_name, brand_id, location, kind, is_active, created_date, updated_date)
SELECT gen_random_uuid()::text, v.store_name, b.id, NULL, 'commissary', true, now(), now()
FROM public.brands b
CROSS JOIN (VALUES
  ('Angel''s Pizza Commissary'),
  ('Angel''s Pizza Consolacion Commissary'),
  ('Figaro Commissary'),
  ('Tien Ma''s Commissary'),
  ('ISD Commissary'),
  ('Roasting Commissary'),
  ('Tarlac Commissary')
) AS v(store_name)
WHERE b.brand_name = 'Commissaries'
  AND NOT EXISTS (SELECT 1 FROM public.stores WHERE store_name = v.store_name);
