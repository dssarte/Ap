-- New "director" user_type: same read visibility as admin for tickets and
-- audits (so Reports/Analytics/Overview/Audit Dashboard/Conduct Audit work
-- for them), without granting private.is_admin() itself — that stays
-- reserved for actual admins, so Administration/Store Ranking/ticket
-- delete/update-any-ticket stay admin-only.

BEGIN;

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
      AND (
        CASE
          -- A branch/store manager's assigned_stores list is authoritative.
          -- Ownership or a stale approver email must never widen that scope.
          WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager'
            THEN private.manages_store(t.store_name)
          ELSE
            private.is_admin()
            OR coalesce(private.current_profile() ->> 'user_type', '') = 'director'
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
      )
    ELSE
      private.is_qa_or_admin()
      OR coalesce(private.current_profile() ->> 'user_type', '') = 'director'
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

COMMIT;
