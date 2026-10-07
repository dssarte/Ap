-- QAD - 5S Housekeeping Evaluation Checklist. Unlike every other QA
-- checklist, this one has no brand and no fixed location — the source
-- form is one generic sheet re-used across whichever department is being
-- audited (a blank "DEPARTMENT: ____" line on paper), so it's built
-- unrestricted (no store_restrictions) with requires_department instead,
-- which swaps Conduct Audit's brand/store picker for a flat Department
-- dropdown sourced from the existing public.departments list.
--
-- Point-weighted (1pt minor / 5pt major), same as the other QA checklists.
-- Pass threshold 92.5% per standing rule (this sheet itself says 93%).
-- One stale section total in the source (Shitsuke prints 25, its 4 items
-- sum to 20) — scoring is computed live from the item list as always, so
-- this doesn't affect correctness.
INSERT INTO public.audit_templates (
  id, title, description, sections, is_active, template_group, active_ticket,
  pass_threshold, requires_audit_type, requires_visit_number, requires_commitment_date,
  requires_department, has_time_restriction, available_from_time, available_to_time,
  store_restrictions, created_date, updated_date
)
SELECT
  gen_random_uuid()::text,
  '5S Housekeeping Evaluation Checklist',
  'QA 5S (Sort, Set in Order, Shine, Standardize, Sustain) workplace housekeeping evaluation, conducted per department.',
  '[{"id":"5s_s1","title":"I. SEIRI- SORTING","items":[{"id":"5s_s1_i1","label":"No  unnecessary things in area","photo_required":false,"pts":5},{"id":"5s_s1_i2","label":"Usable items is properly arranged.","photo_required":false,"pts":5},{"id":"5s_s1_i3","label":"Old files are separate from new one.","photo_required":false,"pts":5},{"id":"5s_s1_i4","label":"Old files placed on boxes properly labeled","photo_required":false,"pts":5}]},{"id":"5s_s2","title":"II. SEITON- SYSTEMATIC ARRANGEMENT","items":[{"id":"5s_s2_i1","label":"Frequently used items are near the work tables.","photo_required":false,"pts":5},{"id":"5s_s2_i2","label":"Items in desk drawers neatly arranged and easy retrieval.","photo_required":false,"pts":5},{"id":"5s_s2_i3","label":"Cabinets/shelves  are properly arranged.","photo_required":false,"pts":5},{"id":"5s_s2_i4","label":"Cabinets/shelves  are with labels or on color coded on contents of it.","photo_required":false,"pts":5},{"id":"5s_s2_i5","label":"Files, reports, documents are color coded or properly labeled, filed and organized.","photo_required":false,"pts":5},{"id":"5s_s2_i6","label":"Outgoing/ incoming racks/boxes are properly arranged and not full.","photo_required":false,"pts":5},{"id":"5s_s2_i7","label":"Personal items are separated from office supplies.","photo_required":false,"pts":5},{"id":"5s_s2_i8","label":"Documents, files and reports have been minimized in number and are properly arranged for easy retrieval.","photo_required":false,"pts":5},{"id":"5s_s2_i9","label":"Office supplies well arranged and with in easy retrieval.","photo_required":false,"pts":1}]},{"id":"5s_s3","title":"III. SEISO \u2013 SHINE","items":[{"id":"5s_s3_i1","label":"Walls are clean  and no scotch tape, bulletin are organized.","photo_required":false,"pts":5},{"id":"5s_s3_i2","label":"Filing cabinets, shelves and racks are dust free and clean.","photo_required":false,"pts":5},{"id":"5s_s3_i3","label":"Floors are clean, dust free, dry and stain free.","photo_required":false,"pts":5},{"id":"5s_s3_i4","label":"Table- top is clear, dust free and no pile up documents.","photo_required":false,"pts":1},{"id":"5s_s3_i5","label":"Chair is clean","photo_required":false,"pts":1},{"id":"5s_s3_i6","label":"Computer and printer are dust free and no unnecessary things attached.","photo_required":false,"pts":1},{"id":"5s_s3_i7","label":"Garbage and recyclables are collected and disposed correctly","photo_required":false,"pts":1},{"id":"5s_s3_i8","label":"Reports, old files and paper are filed daily","photo_required":false,"pts":1},{"id":"5s_s3_i9","label":"Telephone and fax machine are dust free","photo_required":false,"pts":1}]},{"id":"5s_s4","title":"IV. SEIKETSU \u2013 STANDARDIZING","items":[{"id":"5s_s4_i1","label":"Tables and chairs returned to their original location after used.","photo_required":false,"pts":5},{"id":"5s_s4_i2","label":"Floors are well maintained.","photo_required":false,"pts":5},{"id":"5s_s4_i3","label":"Chairs are in good condition.","photo_required":false,"pts":5},{"id":"5s_s4_i4","label":"Tables are in good condition.","photo_required":false,"pts":5},{"id":"5s_s4_i5","label":"Trash can is available","photo_required":false,"pts":5},{"id":"5s_s4_i6","label":"Computer and printer are in good working condition.","photo_required":false,"pts":5},{"id":"5s_s4_i7","label":"Phone and fax machine are in good condition.","photo_required":false,"pts":5},{"id":"5s_s4_i8","label":"Cabinets/shelves and racks are in good condition.","photo_required":false,"pts":5},{"id":"5s_s4_i9","label":"Cable and wires are properly installed and in good appearance.","photo_required":false,"pts":5},{"id":"5s_s4_i10","label":"The first 3S (sort, systematic arrangement, shine) being maintained.","photo_required":false,"pts":5}]},{"id":"5s_s5","title":"V. SHITSUKE \u2013 SELF DISCIPLINE","items":[{"id":"5s_s5_i1","label":"Wiping of desk/ area at least 5 minutes every morning.","photo_required":false,"pts":5},{"id":"5s_s5_i2","label":"Comply on corporate attire during weekdays M-TH (No maong,t-shirt, slippers,rubber shoes, spag.straps)","photo_required":false,"pts":5},{"id":"5s_s5_i3","label":"Staff is fully understands 5S procedures","photo_required":false,"pts":5},{"id":"5s_s5_i4","label":"Person is friendly and  approachable.","photo_required":false,"pts":5}]}]'::jsonb,
  true, 'others', false,
  92.5, true, false, false,
  true, false, '', '',
  '[]'::jsonb,
  now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_templates WHERE title = '5S Housekeeping Evaluation Checklist'
);
