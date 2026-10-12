-- 20260907010000_director_role_access gave directors admin-level READ access
-- to all audit submissions (OR user_type = 'director' in can_access_audit).
-- 20261002020000_can_access_audit_single_profile_lookup then rewrote the
-- function for performance, describing its logic as unchanged, but dropped
-- that director clause — since then directors only see their own
-- submissions on Audit Dashboard, History, and every other audit view.
-- This restores it, keeping the single-profile-lookup rewrite. Directors
-- now also get Store Ranking and QA Dashboard, which read through this same
-- check.
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
    user_type IN ('admin', 'director')
    OR lower(coalesce(profile ->> 'department_name', '')) = 'quality assurance'
    OR lower(coalesce(p_submitted_by_email, '')) = private.current_email()
    OR (
      nullif(coalesce(profile ->> 'store_name', ''), '') IS NOT NULL
      AND position(lower(profile ->> 'store_name') IN lower(coalesce(p_brand, ''))) > 0
    );
END;
$$;
