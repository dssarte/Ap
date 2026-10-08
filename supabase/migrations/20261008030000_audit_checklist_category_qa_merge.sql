-- Conduct Audit's "QA" tab is being folded into "Store Audit" — one tab
-- instead of two. The 'qa' category value itself is retired; anything
-- still tagged 'qa' moves to 'store_audit'.
UPDATE public.audit_templates
SET checklist_category = 'store_audit'
WHERE checklist_category = 'qa';

-- 5S Housekeeping was filed under 'qa' by a judgment call in the previous
-- migration (it wasn't on the user's original named tab list). It now has
-- an explicit home: Head Office (the 'mayon' category's new display label).
UPDATE public.audit_templates
SET checklist_category = 'mayon'
WHERE title = '5S Housekeeping Evaluation Checklist';
