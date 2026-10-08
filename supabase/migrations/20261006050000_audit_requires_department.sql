-- Departments checklists (starting with 5S Housekeeping Evaluation) don't
-- fit the store/facility picker at all — there's no brand, and no fixed
-- single location like Mayon Building. The source form is just one generic
-- sheet with a blank "DEPARTMENT: ____" line filled in by hand each time.
--
-- Rather than faking department rows into `stores`, this reuses the
-- existing Departments list tickets already route to (public.departments)
-- via a dedicated dropdown in Conduct Audit, gated by this new opt-in flag
-- — same pattern as requires_audit_type/requires_visit_number/
-- requires_commitment_date. The chosen department's name is written into
-- `brand` (the field every other audit view already treats as "whatever
-- the audited target is called"), so no new audit_submissions column is
-- needed and every existing view (history, detail, PDF export) just works.
ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS requires_department boolean NOT NULL DEFAULT false;
