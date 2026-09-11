-- Two additions needed for the new QA audit checklists:
--
-- 1. Different brands/checklists pass at different score thresholds (e.g.
--    93% for the new Angel's Pizza Express QA audit vs the app's previous
--    flat 75% for everyone) — pass_threshold now lives per template instead
--    of being one hardcoded constant in Store Ranking.
-- 2. Some QA audits record whether the visit was Unannounced/Follow-up/Spot.
--    requires_audit_type is a per-template opt-in (most store checklists
--    don't need this field at all), audit_type is what gets recorded on the
--    submission when a template asks for it.

BEGIN;

ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS pass_threshold numeric NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS requires_audit_type boolean NOT NULL DEFAULT false;

ALTER TABLE public.audit_submissions
  ADD COLUMN IF NOT EXISTS audit_type text;

COMMIT;
