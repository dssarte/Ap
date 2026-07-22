-- FCG HelpDesk: production Row Level Security policies
--
-- Run this entire file in the Supabase SQL Editor after complete_setup.sql.
-- It replaces the insecure local_testing_all policies that granted anonymous
-- and authenticated users unrestricted access to every application table.
--
-- This script is idempotent: it can be run again when policies need refreshing.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- The signed-in email comes from the verified Supabase access token, never
-- from data supplied by the browser request.
CREATE OR REPLACE FUNCTION private.current_email()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- Read the application profile without recursively invoking the users policy.
CREATE OR REPLACE FUNCTION private.current_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (
      SELECT to_jsonb(u)
      FROM public.users AS u
      WHERE lower(trim(u.email)) = private.current_email()
      LIMIT 1
    ),
    '{}'::jsonb
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(private.current_profile() ->> 'user_type', '') = 'admin'
$$;

CREATE OR REPLACE FUNCTION private.is_qa_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_admin()
    OR lower(coalesce(private.current_profile() ->> 'department_name', '')) = 'quality assurance'
$$;

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
      AND (
        CASE
          WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager' THEN
            EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(
                coalesce(private.current_profile() -> 'assigned_stores', '[]'::jsonb)
              ) AS assigned(store_name)
              WHERE lower(trim(assigned.store_name)) = lower(trim(p_store_name))
            )
          ELSE lower(coalesce(private.current_profile() ->> 'store_name', '')) = lower(trim(p_store_name))
        END
      )
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
      AND (
        CASE
          -- A branch/store manager's assigned_stores list is authoritative.
          -- Ownership or a stale approver email must never widen that scope.
          WHEN coalesce(private.current_profile() ->> 'user_type', '') = 'store_manager'
            THEN private.manages_store(t.store_name)
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
  )
$$;

CREATE OR REPLACE FUNCTION private.can_view_internal_comment(p_ticket_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_admin() OR EXISTS (
    SELECT 1
    FROM public.tickets AS t
    WHERE t.id = p_ticket_id
      AND coalesce(private.current_profile() ->> 'user_type', '') = 'department_head'
      AND coalesce(t.handling_department_id, t.department_id, '') =
          coalesce(private.current_profile() ->> 'department_id', '')
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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Delete every old policy on the application's tables. This is deliberate:
-- permissive policies are OR-ed together, so leaving one old true policy in
-- place would bypass every restrictive policy below.
DO $$
DECLARE
  policy_record record;
  app_tables constant text[] := ARRAY[
    'users', 'brands', 'stores', 'departments', 'categories', 'slas',
    'canned_responses', 'ticket_rules', 'pending_users', 'checklist_configs',
    'audit_templates', 'audit_assignments', 'tickets', 'ticket_comments',
    'ticket_feedback', 'notifications', 'audit_submissions'
  ];
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;

  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY(app_tables)
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

-- Shared reference data: signed-in users can read it; only admins can change it.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'brands', 'stores', 'departments', 'categories', 'slas',
    'canned_responses', 'ticket_rules', 'checklist_configs', 'audit_templates'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)',
      table_name || '_authenticated_read', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()))',
      table_name || '_admin_insert', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))',
      table_name || '_admin_update', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT private.is_admin()))',
      table_name || '_admin_delete', table_name
    );
  END LOOP;
END $$;

-- User directory. All signed-in users need names/emails for assignment and
-- approval screens. Users may edit their own contact fields, but not roles.
CREATE POLICY users_authenticated_read ON public.users
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY users_admin_or_self_insert ON public.users
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.is_admin())
  OR (
    lower(trim(email)) = (SELECT private.current_email())
    AND coalesce(user_type, 'user') = 'user'
    AND coalesce(role, 'user') = 'user'
    AND coalesce(app_role, 'user') = 'user'
  )
);

CREATE POLICY users_admin_or_self_update ON public.users
FOR UPDATE TO authenticated
USING (
  (SELECT private.is_admin())
  OR lower(trim(email)) = (SELECT private.current_email())
)
WITH CHECK (
  (SELECT private.is_admin())
  OR lower(trim(email)) = (SELECT private.current_email())
);

CREATE POLICY users_admin_delete ON public.users
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

CREATE OR REPLACE FUNCTION private.protect_user_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed_keys text[] := ARRAY['full_name', 'display_name', 'phone', 'updated_date'];
BEGIN
  IF private.is_admin() THEN
    RETURN NEW;
  END IF;

  -- The registration page completes a new profile once. After a department
  -- has been set, changing it requires an administrator.
  IF OLD.department_id IS NULL THEN
    allowed_keys := allowed_keys || ARRAY['department_id', 'department_name'];
  END IF;

  IF (to_jsonb(NEW) - allowed_keys)
     IS DISTINCT FROM
     (to_jsonb(OLD) - allowed_keys) THEN
    RAISE EXCEPTION 'Only an administrator can change account roles or access settings.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.protect_user_privileges() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_user_privileges ON public.users;
CREATE TRIGGER protect_user_privileges
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION private.protect_user_privileges();

-- Pending invitations contain sensitive account setup information.
CREATE POLICY pending_users_admin_read ON public.pending_users
FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
CREATE POLICY pending_users_admin_insert ON public.pending_users
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY pending_users_admin_update ON public.pending_users
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY pending_users_admin_delete ON public.pending_users
FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- Audit assignments are visible to the assignee and administrators.
CREATE POLICY audit_assignments_owner_read ON public.audit_assignments
FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin())
  OR lower(coalesce(user_email, '')) = (SELECT private.current_email())
);
CREATE POLICY audit_assignments_admin_insert ON public.audit_assignments
FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY audit_assignments_admin_update ON public.audit_assignments
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY audit_assignments_admin_delete ON public.audit_assignments
FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- Tickets are restricted by ownership, assignment, department, approval role,
-- or the store manager's assigned stores.
CREATE POLICY tickets_scoped_read ON public.tickets
FOR SELECT TO authenticated
USING ((SELECT private.can_access_ticket(id)));

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

CREATE POLICY tickets_scoped_update ON public.tickets
FOR UPDATE TO authenticated
USING ((SELECT private.can_access_ticket(id)))
WITH CHECK ((SELECT private.can_access_ticket(id)));

CREATE POLICY tickets_admin_delete ON public.tickets
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

-- Comments inherit access from their parent ticket. Internal comments are
-- limited to administrators and the responsible department head.
CREATE POLICY ticket_comments_scoped_read ON public.ticket_comments
FOR SELECT TO authenticated
USING (
  (SELECT private.can_access_ticket(ticket_id))
  AND (
    coalesce(is_internal, false) = false
    OR (SELECT private.can_view_internal_comment(ticket_id))
  )
);

CREATE POLICY ticket_comments_scoped_insert ON public.ticket_comments
FOR INSERT TO authenticated
WITH CHECK (
  lower(coalesce(author_email, '')) = (SELECT private.current_email())
  AND (SELECT private.can_access_ticket(ticket_id))
  AND (
    coalesce(is_internal, false) = false
    OR (SELECT private.can_view_internal_comment(ticket_id))
  )
);

CREATE POLICY ticket_comments_owner_update ON public.ticket_comments
FOR UPDATE TO authenticated
USING (
  (SELECT private.is_admin())
  OR lower(coalesce(author_email, '')) = (SELECT private.current_email())
)
WITH CHECK (
  (SELECT private.is_admin())
  OR (
    lower(coalesce(author_email, '')) = (SELECT private.current_email())
    AND (SELECT private.can_access_ticket(ticket_id))
  )
);

CREATE POLICY ticket_comments_owner_delete ON public.ticket_comments
FOR DELETE TO authenticated
USING (
  (SELECT private.is_admin())
  OR lower(coalesce(author_email, '')) = (SELECT private.current_email())
);

-- Feedback inherits ticket visibility and can only be submitted by the ticket owner.
CREATE POLICY ticket_feedback_scoped_read ON public.ticket_feedback
FOR SELECT TO authenticated
USING ((SELECT private.can_access_ticket(ticket_id)));
CREATE POLICY ticket_feedback_owner_insert ON public.ticket_feedback
FOR INSERT TO authenticated
WITH CHECK (
  lower(coalesce(submitter_email, '')) = (SELECT private.current_email())
  AND (SELECT private.can_access_ticket(ticket_id))
);
CREATE POLICY ticket_feedback_admin_update ON public.ticket_feedback
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY ticket_feedback_admin_delete ON public.ticket_feedback
FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- Users can only read and maintain their own notifications. A participant may
-- create notifications for the other participants of a ticket they can access.
CREATE POLICY notifications_owner_read ON public.notifications
FOR SELECT TO authenticated
USING (lower(coalesce(user_email, '')) = (SELECT private.current_email()));
CREATE POLICY notifications_ticket_participant_insert ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  lower(coalesce(user_email, '')) = (SELECT private.current_email())
  OR (ticket_id IS NOT NULL AND (SELECT private.can_access_ticket(ticket_id)))
  OR (SELECT private.is_admin())
);
CREATE POLICY notifications_owner_update ON public.notifications
FOR UPDATE TO authenticated
USING (lower(coalesce(user_email, '')) = (SELECT private.current_email()))
WITH CHECK (lower(coalesce(user_email, '')) = (SELECT private.current_email()));
CREATE POLICY notifications_owner_delete ON public.notifications
FOR DELETE TO authenticated
USING (
  lower(coalesce(user_email, '')) = (SELECT private.current_email())
  OR (SELECT private.is_admin())
);

-- Audits are visible to their submitter, QA/admin, and the applicable store.
CREATE POLICY audit_submissions_scoped_read ON public.audit_submissions
FOR SELECT TO authenticated
USING ((SELECT private.can_access_audit(brand, submitted_by_email)));
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
CREATE POLICY audit_submissions_admin_update ON public.audit_submissions
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()));
CREATE POLICY audit_submissions_admin_delete ON public.audit_submissions
FOR DELETE TO authenticated USING ((SELECT private.is_admin()));

-- The attachments bucket remains public so existing getPublicUrl() links keep
-- working. Removing its SELECT policy prevents clients from listing all files;
-- public buckets do not require that policy to serve a known object URL.
DROP POLICY IF EXISTS "attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "attachments authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "attachments authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "attachments authenticated delete" ON storage.objects;

CREATE POLICY "attachments authenticated upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "attachments authenticated update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (SELECT private.is_admin())
  )
)
WITH CHECK (
  bucket_id = 'attachments'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (SELECT private.is_admin())
  )
);

CREATE POLICY "attachments authenticated delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    owner_id = (SELECT auth.uid()::text)
    OR (SELECT private.is_admin())
  )
);

-- Indexes used by policy predicates. These are safe to create repeatedly.
CREATE INDEX IF NOT EXISTS users_email_rls_idx
  ON public.users (lower(trim(email)));
CREATE INDEX IF NOT EXISTS tickets_submitter_rls_idx
  ON public.tickets (lower(submitter_email));
CREATE INDEX IF NOT EXISTS tickets_approver_rls_idx
  ON public.tickets (lower(approver_email));
CREATE INDEX IF NOT EXISTS tickets_assigned_rls_idx
  ON public.tickets (lower(assigned_to));
CREATE INDEX IF NOT EXISTS tickets_department_rls_idx
  ON public.tickets (handling_department_id, department_id);
CREATE INDEX IF NOT EXISTS tickets_store_rls_idx
  ON public.tickets (lower(store_name));
CREATE INDEX IF NOT EXISTS ticket_comments_ticket_rls_idx
  ON public.ticket_comments (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_feedback_ticket_rls_idx
  ON public.ticket_feedback (ticket_id);
CREATE INDEX IF NOT EXISTS notifications_owner_rls_idx
  ON public.notifications (lower(user_email));
CREATE INDEX IF NOT EXISTS audit_submissions_owner_rls_idx
  ON public.audit_submissions (lower(submitted_by_email));

COMMIT;

-- Verification 1: this should return zero rows after the script succeeds.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    lower(coalesce(qual, '')) IN ('true', '(true)')
    OR lower(coalesce(with_check, '')) IN ('true', '(true)')
  )
ORDER BY tablename, policyname;

-- Verification 2: this should also return zero rows. The public bucket itself
-- serves known URLs, while the absence of a SELECT policy prevents listing.
SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'SELECT'
  AND qual ILIKE '%attachments%';
