-- Fixes the recurring 57014 statement timeouts on list_audit_submissions
-- (QA Dashboard, Store Ranking) confirmed via Supabase logs on 2026-10-07.
-- Without this index, filtering by template_ids forces Postgres to walk
-- the date-ordered rows and discard everything that doesn't match — most
-- of the table, since daily OD/Opening/Closing checklists happen many
-- times a day while QA checklists happen a handful of times a month.
-- Widened from 5 to 18 QA template IDs by today's new checklists, which
-- is what pushed this from "slow" to "times out".
--
-- CONCURRENTLY avoids locking the table during the build on a live
-- database, but it cannot run inside a transaction block — run this
-- statement on its own, not pasted together with other SQL.
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_submissions_template_date_idx
  ON public.audit_submissions (template_id, business_date DESC, id DESC);
