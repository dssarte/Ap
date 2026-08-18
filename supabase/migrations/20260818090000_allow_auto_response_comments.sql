-- The existing ticket_comments insert policy requires author_email to match
-- the logged-in user, which blocks the client from posting the automated
-- "auto-response@system" comment right after creating a ticket. This adds a
-- narrow, additional policy just for that fixed sentinel email, still gated
-- on the caller actually being able to access the ticket.

BEGIN;

DROP POLICY IF EXISTS ticket_comments_auto_response_insert ON public.ticket_comments;
CREATE POLICY ticket_comments_auto_response_insert ON public.ticket_comments
FOR INSERT TO authenticated
WITH CHECK (
  lower(coalesce(author_email, '')) = 'auto-response@system'
  AND (SELECT private.can_access_ticket(ticket_id))
);

COMMIT;
