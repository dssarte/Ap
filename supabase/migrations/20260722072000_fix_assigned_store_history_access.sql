-- Preserve branch-manager access to historical tickets/audits by assignment.
-- A store may be renamed or deactivated after records were created; removing
-- the store from assigned_stores remains the operation that revokes access.

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
