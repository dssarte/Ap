-- FCG HelpDesk: reset transactional ticket and audit data
--
-- PURPOSE
--   Start with a clean operational history while preserving configuration.
--
-- DELETES
--   public.ticket_comments
--   public.ticket_feedback
--   public.notifications
--   public.tickets
--   public.audit_submissions
--
-- PRESERVES
--   Auth accounts, user profiles, departments, categories, SLA policies,
--   canned responses, rules, brands, stores, audit templates, assignments,
--   checklist configuration, and pending users.
--
-- IMPORTANT
--   1. Back up the database before running this file.
--   2. This file is unlocked and will delete the listed data when run.
--   3. Run the entire file in the Supabase SQL Editor.
--   4. This operation cannot be undone without a backup.
--   5. This does not remove uploaded files from the Storage attachments bucket.

BEGIN;

-- Deliberate safety lock. The transaction stops unless the confirmation text
-- is changed to the exact value shown in the instructions above.
DO $$
DECLARE
  confirmation CONSTANT text := 'RESET_FCG_TRANSACTIONAL_DATA';
BEGIN
  IF confirmation <> 'RESET_FCG_TRANSACTIONAL_DATA' THEN
    RAISE EXCEPTION
      'Reset cancelled. Replace CHANGE_ME with RESET_FCG_TRANSACTIONAL_DATA after confirming that a backup exists.';
  END IF;
END;
$$;

-- Delete dependent records before their parent ticket/audit records.
DELETE FROM public.ticket_comments;
DELETE FROM public.ticket_feedback;
DELETE FROM public.notifications;
DELETE FROM public.tickets;
DELETE FROM public.audit_submissions;

-- Abort rather than commit if any targeted table still contains data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ticket_comments LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.ticket_feedback LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.notifications LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.tickets LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.audit_submissions LIMIT 1) THEN
    RAISE EXCEPTION 'Reset verification failed. No changes were committed.';
  END IF;
END;
$$;

COMMIT;

-- Final verification: every value should be zero.
SELECT
  (SELECT count(*) FROM public.tickets) AS tickets,
  (SELECT count(*) FROM public.ticket_comments) AS ticket_comments,
  (SELECT count(*) FROM public.ticket_feedback) AS ticket_feedback,
  (SELECT count(*) FROM public.notifications) AS notifications,
  (SELECT count(*) FROM public.audit_submissions) AS audit_submissions;
