-- Opt-in flag for templates that support importing an already-completed
-- Excel checklist (Mystery Shopper reports, filled out externally by a
-- shopper who never gets a system login) instead of being filled in
-- click-by-click through Conduct Audit. Gates a new "Import from Excel"
-- entry point there; off by default so every existing template is
-- unaffected.
ALTER TABLE public.audit_templates
  ADD COLUMN IF NOT EXISTS supports_excel_import boolean NOT NULL DEFAULT false;
