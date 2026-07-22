-- Make assigned_stores the only operational scope for store/branch managers.
-- Empty assignments mean no ticket approval, audit, or analytics access.

BEGIN;

CREATE OR REPLACE FUNCTION private.manages_store(p_store_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    private.is_admin()
    OR (
      nullif(trim(p_store_name), '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.stores AS active_store
        WHERE lower(trim(active_store.store_name)) = lower(trim(p_store_name))
          AND coalesce(active_store.is_active, true)
      )
      AND CASE
        WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager' THEN
          EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              coalesce(private.current_profile() -> 'assigned_stores', '[]'::jsonb)
            ) AS assigned(store_name)
            WHERE lower(trim(assigned.store_name)) = lower(trim(p_store_name))
          )
        ELSE
          lower(coalesce(private.current_profile() ->> 'store_name', '')) = lower(trim(p_store_name))
      END
    )
$$;

CREATE OR REPLACE FUNCTION private.can_access_ticket(p_ticket_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets AS t
    WHERE t.id = p_ticket_id
      AND CASE
        WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager' THEN
          private.manages_store(t.store_name)
        ELSE
          private.is_admin()
          OR lower(coalesce(t.submitter_email, '')) = private.current_email()
          OR lower(coalesce(t.approver_email, '')) = private.current_email()
          OR lower(coalesce(t.assigned_to, '')) = private.current_email()
          OR (
            coalesce(private.current_profile() ->> 'user_type', '') = 'department_head'
            AND (
              coalesce(t.handling_department_id, t.department_id, '') =
                coalesce(private.current_profile() ->> 'department_id', '')
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(coalesce(t.handling_history, '[]'::jsonb)) AS history(entry)
                WHERE coalesce(history.entry ->> 'department_id', '') =
                  coalesce(private.current_profile() ->> 'department_id', '')
              )
            )
          )
          OR private.manages_store(t.store_name)
      END
  )
$$;

CREATE OR REPLACE FUNCTION private.can_access_audit(
  p_brand text,
  p_submitted_by_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager' THEN
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          coalesce(private.current_profile() -> 'assigned_stores', '[]'::jsonb)
        ) AS assigned(store_name)
        WHERE position(lower(trim(assigned.store_name)) IN lower(coalesce(p_brand, ''))) > 0
          AND EXISTS (
            SELECT 1
            FROM public.stores AS active_store
            WHERE lower(trim(active_store.store_name)) = lower(trim(assigned.store_name))
              AND coalesce(active_store.is_active, true)
          )
      )
    ELSE
      private.is_qa_or_admin()
      OR lower(coalesce(p_submitted_by_email, '')) = private.current_email()
      OR (
        nullif(coalesce(private.current_profile() ->> 'store_name', ''), '') IS NOT NULL
        AND position(
          lower(private.current_profile() ->> 'store_name')
          IN lower(coalesce(p_brand, ''))
        ) > 0
      )
  END
$$;

-- SECURITY DEFINER RPCs bypass table RLS. These triggers keep their writes
-- inside the manager's current store scope as a second line of defense.
CREATE OR REPLACE FUNCTION private.enforce_store_manager_record_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(private.current_profile() ->> 'user_type', '') <> 'store_manager' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'tickets' AND NOT private.manages_store(NEW.store_name) THEN
    RAISE EXCEPTION 'This store is not assigned to your branch manager account.';
  END IF;

  IF TG_TABLE_NAME = 'audit_submissions'
     AND NOT private.can_access_audit(NEW.brand, NEW.submitted_by_email) THEN
    RAISE EXCEPTION 'This store is not assigned to your branch manager account.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_store_manager_record_scope()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_store_manager_ticket_scope ON public.tickets;
CREATE TRIGGER enforce_store_manager_ticket_scope
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION private.enforce_store_manager_record_scope();

DROP TRIGGER IF EXISTS enforce_store_manager_audit_scope ON public.audit_submissions;
CREATE TRIGGER enforce_store_manager_audit_scope
BEFORE INSERT OR UPDATE ON public.audit_submissions
FOR EACH ROW EXECUTE FUNCTION private.enforce_store_manager_record_scope();

-- Direct table writes must obey the same rule as the protected RPCs.
DROP POLICY IF EXISTS tickets_owner_insert ON public.tickets;
CREATE POLICY tickets_owner_insert ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  (
    lower(coalesce(submitter_email, '')) = (SELECT private.current_email())
    AND (
      coalesce((SELECT private.current_profile()) ->> 'user_type', '') <> 'store_manager'
      OR (SELECT private.manages_store(store_name))
    )
  )
  OR (SELECT private.is_admin())
);

DROP POLICY IF EXISTS audit_submissions_owner_insert ON public.audit_submissions;
CREATE POLICY audit_submissions_owner_insert ON public.audit_submissions
FOR INSERT TO authenticated
WITH CHECK (
  (
    lower(coalesce(submitted_by_email, '')) = (SELECT private.current_email())
    AND (
      coalesce((SELECT private.current_profile()) ->> 'user_type', '') <> 'store_manager'
      OR (SELECT private.can_access_audit(brand, submitted_by_email))
    )
  )
  OR (SELECT private.is_admin())
);

COMMIT;

