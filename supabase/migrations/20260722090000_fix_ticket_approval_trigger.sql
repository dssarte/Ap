-- Fix Store Manager ticket approvals failing with:
--   record "new" has no field "brand"
--
-- The same trigger function protects tickets and audit submissions. PostgreSQL
-- must not evaluate audit-only NEW fields while the trigger is running for a
-- ticket. Store assignment and template restrictions remain unchanged.

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

  IF TG_TABLE_NAME = 'tickets' THEN
    IF NOT private.manages_store(NEW.store_name) THEN
      RAISE EXCEPTION 'This store is not assigned to your branch manager account.';
    END IF;
  ELSIF TG_TABLE_NAME = 'audit_submissions' THEN
    IF NOT private.can_access_audit(NEW.brand, NEW.submitted_by_email) THEN
      RAISE EXCEPTION 'This store is not assigned to your branch manager account.';
    END IF;

    IF NOT EXISTS (
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
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_store_manager_record_scope()
  FROM PUBLIC, anon, authenticated;

COMMIT;
