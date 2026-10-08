-- Conduct Audit is getting top-level category tabs (QA, Mystery Shopper,
-- Store Audit, Store Punchlist, Commissary, Warehouse, Mayon) instead of
-- one long searchable list. This is a separate axis from `template_group`
-- (which is brand-based, for the admin editor's own tabs) — a brand can
-- have templates in several different categories (e.g. Angel's Pizza has
-- a QA checklist, a Punchlist, AND a Mystery Shopper checklist, all under
-- template_group='angels-pizza' but different categories here).
--
-- Backfilled by title pattern for every template that already exists —
-- 'store_audit' is both the default for new rows and the catch-all here,
-- since that's what the pre-existing daily Opening/Closing/OD/Mid
-- checklists are. One judgment call: 5S Housekeeping Evaluation isn't on
-- the user's named tab list — filed under 'qa' since it's QA-conducted
-- like everything else there; easy to move later if that's wrong.
ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS checklist_category text NOT NULL DEFAULT 'store_audit';

UPDATE public.audit_templates
SET checklist_category = CASE
  WHEN title = 'Mayon Daily Walkthrough Housekeeping Checklist' THEN 'mayon'
  WHEN title ILIKE '%Mystery Shopper%' THEN 'mystery_shopper'
  WHEN title ILIKE '%Punchlist%' THEN 'punchlist'
  WHEN title ILIKE '%Commissary%' THEN 'commissary'
  WHEN title ILIKE '%Warehouse%' THEN 'warehouse'
  WHEN title ILIKE '%QA Audit Checklist%' OR title = '5S Housekeeping Evaluation Checklist' THEN 'qa'
  ELSE 'store_audit'
END;
