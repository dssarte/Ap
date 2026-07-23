-- Use the Users table Display Name consistently for ticket submitters,
-- approvers, and chat authors. Existing history is refreshed once, and future
-- ticket/comment writes are normalized even when they come from an older RPC.

BEGIN;

CREATE OR REPLACE FUNCTION private.display_name_for_email(p_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    nullif(trim(u.display_name), ''),
    nullif(trim(u.full_name), ''),
    nullif(trim(u.email), ''),
    nullif(trim(p_email), '')
  )
  FROM public.users AS u
  WHERE lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.display_name_for_email(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.apply_ticket_display_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_name text;
BEGIN
  IF TG_TABLE_NAME = 'tickets' THEN
    IF nullif(trim(coalesce(NEW.submitter_email, '')), '') IS NOT NULL THEN
      resolved_name := private.display_name_for_email(NEW.submitter_email);
      NEW.submitter_name := coalesce(resolved_name, NEW.submitter_name, NEW.submitter_email);
    END IF;

    IF nullif(trim(coalesce(NEW.approver_email, '')), '') IS NOT NULL THEN
      resolved_name := private.display_name_for_email(NEW.approver_email);
      NEW.approver_name := coalesce(resolved_name, NEW.approver_name, NEW.approver_email);
    END IF;
  ELSIF TG_TABLE_NAME = 'ticket_comments' THEN
    IF nullif(trim(coalesce(NEW.author_email, '')), '') IS NOT NULL THEN
      resolved_name := private.display_name_for_email(NEW.author_email);
      NEW.author_name := coalesce(resolved_name, NEW.author_name, NEW.author_email);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.apply_ticket_display_names()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS apply_ticket_display_names ON public.tickets;
CREATE TRIGGER apply_ticket_display_names
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.apply_ticket_display_names();

DROP TRIGGER IF EXISTS apply_ticket_comment_display_names ON public.ticket_comments;
CREATE TRIGGER apply_ticket_comment_display_names
BEFORE INSERT OR UPDATE ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION private.apply_ticket_display_names();

CREATE OR REPLACE FUNCTION private.sync_changed_user_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_name text := coalesce(
    nullif(trim(NEW.display_name), ''),
    nullif(trim(NEW.full_name), ''),
    NEW.email
  );
BEGIN
  UPDATE public.tickets
  SET submitter_name = resolved_name
  WHERE lower(trim(submitter_email)) = lower(trim(NEW.email));

  UPDATE public.tickets
  SET approver_name = resolved_name
  WHERE lower(trim(approver_email)) = lower(trim(NEW.email));

  UPDATE public.ticket_comments
  SET author_name = resolved_name
  WHERE lower(trim(author_email)) = lower(trim(NEW.email));

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_changed_user_display_name()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_changed_user_display_name ON public.users;
CREATE TRIGGER sync_changed_user_display_name
AFTER UPDATE OF display_name, full_name ON public.users
FOR EACH ROW
WHEN (
  OLD.display_name IS DISTINCT FROM NEW.display_name
  OR OLD.full_name IS DISTINCT FROM NEW.full_name
)
EXECUTE FUNCTION private.sync_changed_user_display_name();

-- Refresh existing ticket and chat history using the current Display Name.
UPDATE public.tickets AS ticket
SET submitter_name = coalesce(
      nullif(trim(profile.display_name), ''),
      nullif(trim(profile.full_name), ''),
      profile.email
    )
FROM public.users AS profile
WHERE lower(trim(ticket.submitter_email)) = lower(trim(profile.email));

UPDATE public.tickets AS ticket
SET approver_name = coalesce(
      nullif(trim(profile.display_name), ''),
      nullif(trim(profile.full_name), ''),
      profile.email
    )
FROM public.users AS profile
WHERE lower(trim(ticket.approver_email)) = lower(trim(profile.email));

UPDATE public.ticket_comments AS comment
SET author_name = coalesce(
      nullif(trim(profile.display_name), ''),
      nullif(trim(profile.full_name), ''),
      profile.email
    )
FROM public.users AS profile
WHERE lower(trim(comment.author_email)) = lower(trim(profile.email));

COMMIT;

-- Verification: all matched ticket/chat names should now equal Display Name.
SELECT
  (SELECT count(*)
   FROM public.tickets AS ticket
   JOIN public.users AS profile
     ON lower(trim(ticket.submitter_email)) = lower(trim(profile.email))
   WHERE ticket.submitter_name IS DISTINCT FROM coalesce(
     nullif(trim(profile.display_name), ''),
     nullif(trim(profile.full_name), ''),
     profile.email
   )) AS ticket_submitter_name_mismatches,
  (SELECT count(*)
   FROM public.ticket_comments AS comment
   JOIN public.users AS profile
     ON lower(trim(comment.author_email)) = lower(trim(profile.email))
   WHERE comment.author_name IS DISTINCT FROM coalesce(
     nullif(trim(profile.display_name), ''),
     nullif(trim(profile.full_name), ''),
     profile.email
   )) AS chat_author_name_mismatches;
