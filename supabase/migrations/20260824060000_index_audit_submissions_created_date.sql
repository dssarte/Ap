-- ORDER BY created_date DESC LIMIT queries on audit_submissions (Conduct
-- Audit history, admin view) degrade into a full-table sort without a
-- supporting index, getting slower as the table grows regardless of how
-- well-scoped the WHERE clause is. This is a safe, additive index — no
-- application logic changes.

CREATE INDEX IF NOT EXISTS audit_submissions_created_date_idx
  ON public.audit_submissions (created_date DESC);

CREATE INDEX IF NOT EXISTS audit_submissions_submitted_by_email_idx
  ON public.audit_submissions (submitted_by_email);
