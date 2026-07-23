-- Replace the standalone Approver user category with an optional approval
-- capability on Department Head accounts.
--
-- Routing rule:
--   * A new ticket is sent for approval to an active Department Head in the
--     submitter's department whose "Can approve tickets" option is enabled.
--   * When no such Department Head exists, the ticket opens immediately and
--     is not left stuck in Pending Approval.
--   * The destination department remains independent, so users and Department
--     Heads may create tickets for either their own or another department.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_approver boolean NOT NULL DEFAULT false;

ALTER TABLE public.pending_users
  ADD COLUMN IF NOT EXISTS is_approver boolean NOT NULL DEFAULT false;

-- Preserve existing standalone approvers by converting them to Department
-- Heads with approval enabled. SQL Editor sessions do not carry the
-- application's administrator JWT, so temporarily pause only the privilege
-- guard that would otherwise reject this controlled migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'protect_user_privileges'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.users DISABLE TRIGGER protect_user_privileges;
  END IF;
END;
$$;

UPDATE public.users
SET user_type = 'department_head',
    is_approver = true,
    role = 'user',
    app_role = 'user',
    updated_date = now()
WHERE user_type = 'approver';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'protect_user_privileges'
      AND NOT tgisinternal
  ) THEN
    ALTER TABLE public.users ENABLE TRIGGER protect_user_privileges;
  END IF;
END;
$$;

UPDATE public.pending_users
SET user_type = 'department_head',
    is_approver = true,
    updated_date = now()
WHERE user_type = 'approver';

CREATE INDEX IF NOT EXISTS users_department_approver_idx
  ON public.users (department_id, is_approver)
  WHERE user_type = 'department_head'
    AND is_approver = true
    AND coalesce(disabled, false) = false;

CREATE OR REPLACE FUNCTION private.route_new_ticket_to_department_approver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  submitter_department_id text;
  selected_approver public.users;
  has_store_manager_approver boolean := false;
BEGIN
  -- Preserve explicit already-processed imports and administrative records.
  IF coalesce(NEW.approval_status, 'pending') <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT profile.department_id
  INTO submitter_department_id
  FROM public.users AS profile
  WHERE lower(trim(profile.email)) = lower(trim(NEW.submitter_email))
  LIMIT 1;

  SELECT profile.*
  INTO selected_approver
  FROM public.users AS profile
  WHERE profile.department_id = submitter_department_id
    AND profile.user_type = 'department_head'
    AND coalesce(profile.is_approver, false)
    AND NOT coalesce(profile.disabled, false)
  ORDER BY profile.created_date, profile.id
  LIMIT 1;

  IF nullif(trim(coalesce(NEW.store_name, '')), '') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.users AS manager
      CROSS JOIN LATERAL jsonb_array_elements_text(
        coalesce(manager.assigned_stores, '[]'::jsonb)
      ) AS assigned(store_name)
      WHERE manager.user_type = 'store_manager'
        AND NOT coalesce(manager.disabled, false)
        AND lower(trim(assigned.store_name)) = lower(trim(NEW.store_name))
    )
    INTO has_store_manager_approver;
  END IF;

  IF selected_approver.id IS NOT NULL THEN
    NEW.approval_status := 'pending';
    NEW.status := 'pending_approval';
    NEW.approver_email := lower(trim(selected_approver.email));
    NEW.approver_name := coalesce(
      nullif(trim(selected_approver.display_name), ''),
      nullif(trim(selected_approver.full_name), ''),
      selected_approver.email
    );
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
  ELSIF has_store_manager_approver THEN
    -- Store Managers retain approval access for their assigned stores.
    NEW.approval_status := 'pending';
    NEW.status := 'pending_approval';
    NEW.approver_email := NULL;
    NEW.approver_name := NULL;
    NEW.approved_at := NULL;
    NEW.rejection_reason := NULL;
  ELSE
    NEW.approval_status := 'approved';
    NEW.status := CASE
      WHEN coalesce(NEW.status, '') = 'pending_approval' THEN 'open'
      ELSE coalesce(nullif(NEW.status, ''), 'open')
    END;
    NEW.approver_email := NULL;
    NEW.approver_name := NULL;
    NEW.approved_at := coalesce(NEW.approved_at, now());
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.route_new_ticket_to_department_approver()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS route_new_ticket_to_department_approver
  ON public.tickets;
CREATE TRIGGER route_new_ticket_to_department_approver
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.route_new_ticket_to_department_approver();

-- A stale approver_email must not let a Department Head approve after the
-- administrator turns off their approval capability.
CREATE OR REPLACE FUNCTION private.enforce_department_head_approval_capability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_profile jsonb := private.current_profile();
  caller_email text := private.current_email();
BEGIN
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status
     AND coalesce(OLD.approval_status, 'pending') = 'pending'
     AND coalesce(NEW.approval_status, '') IN ('approved', 'rejected')
     AND NOT (
       private.is_admin()
       OR (
         coalesce(caller_profile ->> 'user_type', '') = 'store_manager'
         AND private.manages_store(OLD.store_name)
       )
       OR (
         coalesce(caller_profile ->> 'user_type', '') = 'department_head'
         AND lower(coalesce(caller_profile ->> 'is_approver', 'false')) = 'true'
         AND lower(trim(coalesce(OLD.approver_email, ''))) = caller_email
       )
     ) THEN
    RAISE EXCEPTION 'This Department Head account is not enabled to approve this ticket.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_department_head_approval_capability()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_department_head_approval_capability
  ON public.tickets;
CREATE TRIGGER enforce_department_head_approval_capability
BEFORE UPDATE OF approval_status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.enforce_department_head_approval_capability();

COMMIT;

-- Verification: standalone Approver accounts should be zero.
SELECT
  count(*) FILTER (WHERE user_type = 'approver') AS standalone_approver_accounts,
  count(*) FILTER (
    WHERE user_type = 'department_head' AND is_approver
  ) AS department_head_approvers
FROM public.users;
