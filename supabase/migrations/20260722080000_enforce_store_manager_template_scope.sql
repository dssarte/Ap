-- Store managers may submit an audit only when both conditions are true:
--   1. the store is in their assigned_stores list; and
--   2. the audit template applies to that store.
-- Other user types retain their existing behavior.

BEGIN;

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

  IF TG_TABLE_NAME = 'audit_submissions' AND NOT EXISTS (
    SELECT 1
    FROM public.audit_templates AS template_record
    WHERE template_record.id = NEW.template_id
      AND (
        (
          jsonb_array_length(coalesce(template_record.store_restrictions, '[]'::jsonb)) = 0
          AND nullif(trim(coalesce(template_record.store_name, '')), '') IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(template_record.store_restrictions, '[]'::jsonb)) AS restriction(item)
          WHERE nullif(trim(coalesce(restriction.item ->> 'store_name', '')), '') IS NOT NULL
            AND position(
              lower(trim(restriction.item ->> 'store_name'))
              IN lower(coalesce(NEW.brand, ''))
            ) > 0
        )
        OR (
          jsonb_array_length(coalesce(template_record.store_restrictions, '[]'::jsonb)) = 0
          AND nullif(trim(coalesce(template_record.store_name, '')), '') IS NOT NULL
          AND position(
            lower(trim(template_record.store_name))
            IN lower(coalesce(NEW.brand, ''))
          ) > 0
        )
      )
  ) THEN
    RAISE EXCEPTION 'This audit template is not assigned to the selected store.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_store_manager_record_scope()
  FROM PUBLIC, anon, authenticated;

COMMIT;
