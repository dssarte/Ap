-- FCG HelpDesk: start-fresh transactional data reset
--
-- DELETES
--   public.ticket_comments    (ticket chat and internal discussion)
--   public.ticket_feedback
--   public.notifications
--   public.tickets            (manual and audit-generated tickets)
--   public.audit_submissions  (completed/submitted audit reports)
--
-- PRESERVES
--   Supabase Auth accounts, public.users, pending users, departments,
--   categories, SLA policies, canned responses, rules, brands, stores,
--   audit templates, audit assignments, checklist configuration, and all
--   other application settings.
--
-- IMPORTANT
--   1. Back up the database before running this file.
--   2. Run the ENTIRE file in Supabase SQL Editor, not selected sections.
--   3. This cannot be undone without a backup.
--   4. Uploaded files in Supabase Storage are not deleted by this script.

BEGIN;

-- Safety confirmation. Leave this exact value in place only when you intend
-- to permanently clear the operational history listed above.
DO $reset$
DECLARE
  confirmation CONSTANT text := 'RESET_FCG_TRANSACTIONAL_DATA';
BEGIN
  IF confirmation <> 'RESET_FCG_TRANSACTIONAL_DATA' THEN
    RAISE EXCEPTION 'Reset cancelled: confirmation text is incorrect.';
  END IF;
END;
$reset$;

-- Report the number of rows that will be removed.
SELECT
  (SELECT count(*) FROM public.ticket_comments) AS ticket_comments_to_delete,
  (SELECT count(*) FROM public.ticket_feedback) AS ticket_feedback_to_delete,
  (SELECT count(*) FROM public.notifications) AS notifications_to_delete,
  (SELECT count(*) FROM public.tickets) AS tickets_to_delete,
  (SELECT count(*) FROM public.audit_submissions) AS audit_submissions_to_delete;

-- Delete child/dependent records before their parent ticket and audit records.
DELETE FROM public.ticket_comments;
DELETE FROM public.ticket_feedback;
DELETE FROM public.notifications;
DELETE FROM public.tickets;
DELETE FROM public.audit_submissions;

-- Any remaining row aborts the transaction, so a partial reset is never
-- committed.
DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticket_comments LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.ticket_feedback LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.notifications LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.tickets LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.audit_submissions LIMIT 1) THEN
    RAISE EXCEPTION 'Reset verification failed. The transaction was rolled back.';
  END IF;
END;
$verify$;

COMMIT;

-- Successful result: every value below must be zero.
SELECT
  (SELECT count(*) FROM public.ticket_comments) AS ticket_comments,
  (SELECT count(*) FROM public.ticket_feedback) AS ticket_feedback,
  (SELECT count(*) FROM public.notifications) AS notifications,
  (SELECT count(*) FROM public.tickets) AS tickets,
  (SELECT count(*) FROM public.audit_submissions) AS audit_submissions;
