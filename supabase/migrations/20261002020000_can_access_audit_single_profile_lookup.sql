-- can_access_audit() runs on every row of audit_submissions (via both the
-- audit_submissions RLS policies and list_audit_submissions' WHERE clause).
-- As written, it calls private.current_profile() — a `users` table lookup —
-- 2 to 4 times per row, because it's built from nested function calls
-- (is_qa_or_admin() -> is_admin() -> current_profile()) that each
-- independently re-fetch the same unchanging profile for the current
-- request. A month of data across several templates and every brand is
-- tens of thousands of rows, so that's tens of thousands of redundant
-- lookups on top of the per-row cost that's actually unavoidable.
--
-- This rewrites it in plpgsql with a single local `profile` variable,
-- fetched once per row instead of 2-4 times. The predicate logic is
-- unchanged — is_qa_or_admin() OR submitted_by_email match OR store_name
-- match is exactly (user_type = 'admin' OR department_name = 'quality
-- assurance') OR submitted_by_email match OR store_name match — just
-- computed from one cached profile value instead of several independent
-- calls.
CREATE OR REPLACE FUNCTION private.can_access_audit(
  p_brand text,
  p_submitted_by_email text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile jsonb := private.current_profile();
  user_type text := coalesce(profile ->> 'user_type', '');
BEGIN
  IF user_type = 'store_manager' THEN
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(coalesce(profile -> 'assigned_stores', '[]'::jsonb)) AS assigned(store_name)
      WHERE position(lower(trim(assigned.store_name)) IN lower(coalesce(p_brand, ''))) > 0
    );
  END IF;

  RETURN
    user_type = 'admin'
    OR lower(coalesce(profile ->> 'department_name', '')) = 'quality assurance'
    OR lower(coalesce(p_submitted_by_email, '')) = private.current_email()
    OR (
      nullif(coalesce(profile ->> 'store_name', ''), '') IS NOT NULL
      AND position(lower(profile ->> 'store_name') IN lower(coalesce(p_brand, ''))) > 0
    );
END;
$$;
