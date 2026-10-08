-- Angel's Pizza Mystery Shopper (Delivery) — rebuilt from a completed
-- sample (the master "All Brand" workbook was no longer available), since
-- a filled-in copy carries the same item labels/points as the blank
-- template. Excludes 0-point "group header" rows (e.g. "Did the rider
-- wears complete uniform" is just a label for its own "wearing nameplate
-- / head cap / black shoes / clean polo" sub-items below it) since
-- they're not real yes/no questions.
--
-- QA-only (requires_audit_type), point-weighted (5pt per item in this
-- one), pass threshold 92.5% per standing rule, brand-locked to Angels
-- Pizza via store_restrictions (resolved dynamically by brand_name at
-- migration time, so it covers whatever stores are active then, not a
-- hardcoded snapshot). supports_excel_import flags it for the upcoming
-- import feature (column added in the next migration).
INSERT INTO public.audit_templates (
  id, title, description, sections, is_active, template_group, active_ticket,
  pass_threshold, requires_audit_type, requires_visit_number, requires_commitment_date,
  requires_department, has_time_restriction, available_from_time, available_to_time,
  supports_excel_import, store_restrictions, created_date, updated_date
)
SELECT
  gen_random_uuid()::text,
  'Angel''s Pizza Mystery Shopper (Delivery)',
  'Mystery shopper evaluation of the Angel''s Pizza delivery experience: order taking, delivery, product quality, thanking, and general observation.',
  '[{"id":"msdelivery_s1","title":"1.0 ORDER TAKING","items":[{"id":"msdelivery_s1_i1","label":"Answers the phone in few rings?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i2","label":"Proper phone spiel: Thank you for calling Angel\u2019s Pizza delivery this is NAME speaking, would you like to try our (new product)?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i3","label":"Availability of product","photo_required":false,"pts":5},{"id":"msdelivery_s1_i4","label":"Did the CSR voice is audible, lower tone and expressing words clearly?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i5","label":"Did the CSR is knowledgeable with the Product?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i6","label":"Did the CSR is friendly and courteous?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i7","label":"Did the CSR suggest and up-selling products?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i8","label":"Did the CSR ask if the customer has Angel\u2019s Pizza Card?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i9","label":"Did the CSR offer the availment of Angel\u2019s Pizza Card?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i10","label":"Did the CSR ask if the rider needs to bring change?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i11","label":"Did the CSR repeat your orders?","photo_required":false,"pts":5},{"id":"msdelivery_s1_i12","label":"Did the CSR states the Synchronization of time (ETD) estimated delivery time","photo_required":false,"pts":5},{"id":"msdelivery_s1_i13","label":"CSR is easy to talk to?","photo_required":false,"pts":5}]},{"id":"msdelivery_s2","title":"2.0 DELIVERY","items":[{"id":"msdelivery_s2_i1","label":"Did the rider greet you with eye contact and a smile?\nDid the rider greet you warm and introduce his name?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i2","label":"Did the rider repeat the order to the customer?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i3","label":"Did the rider delivered the right order to the customer?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i4","label":"Did the rider ask you if he has served all your orders?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i5","label":"Did the order arrive on time?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i6","label":"Did the rider apologize when the delivery is late? how long?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i7","label":"Did the rider give POS Receipt?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i8","label":"Did the rider give you exact change?","photo_required":false,"pts":5},{"id":"msdelivery_s2_i9","label":"Rider is approachable?","photo_required":false,"pts":5}]},{"id":"msdelivery_s3","title":"3.0 PRODUCT QUALITY","items":[{"id":"msdelivery_s3_i1","label":"Was your food temperature appropriate?","photo_required":false,"pts":5},{"id":"msdelivery_s3_i2","label":"Did it taste good?","photo_required":false,"pts":5},{"id":"msdelivery_s3_i3","label":"Was appearance good (toppings were evenly distributed)?","photo_required":false,"pts":5},{"id":"msdelivery_s3_i4","label":"Did the Pizza are properly/evenly cut?","photo_required":false,"pts":5},{"id":"msdelivery_s3_i5","label":"Delivered pizza with complete condiments like: Hot sauce, Catsup and Tissue?","photo_required":false,"pts":5},{"id":"msdelivery_s3_i6","label":"Pizza box is clean with no spillages or dirt?","photo_required":false,"pts":5}]},{"id":"msdelivery_s4","title":"4.0 THANKING","items":[{"id":"msdelivery_s4_i1","label":"Did the rider thanked you and excused himself?","photo_required":false,"pts":5},{"id":"msdelivery_s4_i2","label":"Did the rider tell you to order again?","photo_required":false,"pts":5},{"id":"msdelivery_s4_i3","label":"Did the rider tell you to enjoy your order?","photo_required":false,"pts":5}]},{"id":"msdelivery_s5","title":"5.0 GENERAL OBSERVATION","items":[{"id":"msdelivery_s5_i1","label":"Did the store calls the customer to inform that the delivery will be delay?","photo_required":false,"pts":5},{"id":"msdelivery_s5_i2","label":"Is the delivery motorcycle clean?","photo_required":false,"pts":5},{"id":"msdelivery_s5_i3","label":"Was the Carry box in good condition?","photo_required":false,"pts":5},{"id":"msdelivery_s5_i4","label":"Did the staff give you flyers or attach in pizza box?","photo_required":false,"pts":5},{"id":"msdelivery_s5_i5","label":"Did we meet your over all expectation?","photo_required":false,"pts":5}]}]'::jsonb,
  true, 'angels-pizza', false,
  92.5, true, false, false,
  false, false, '', '',
  true,
  (
    SELECT jsonb_agg(jsonb_build_object('brand_id', b.id, 'brand_name', b.brand_name, 'store_id', s.id, 'store_name', s.store_name))
    FROM public.stores s
    JOIN public.brands b ON b.id = s.brand_id
    WHERE b.brand_name = 'Angels Pizza' AND coalesce(s.is_active, true) AND coalesce(s.kind, 'store') = 'store'
  ),
  now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_templates WHERE title = 'Angel''s Pizza Mystery Shopper (Delivery)'
);
