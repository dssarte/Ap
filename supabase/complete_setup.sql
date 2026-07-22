-- Run this AFTER helpdesk_supabase_local.sql.
-- Adds fields required by the React application and configures file uploads.
BEGIN;

ALTER TABLE public.canned_responses
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS department_id TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;

ALTER TABLE public.ticket_rules
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;

ALTER TABLE public.pending_users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT,
  ADD COLUMN IF NOT EXISTS department_id TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS assigned_stores JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;

ALTER TABLE public.audit_submissions
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS template_title TEXT,
  ADD COLUMN IF NOT EXISTS submission_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by_email TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS no_comments JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS item_photos JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score NUMERIC,
  ADD COLUMN IF NOT EXISTS total_items INTEGER,
  ADD COLUMN IF NOT EXISTS yes_count INTEGER,
  ADD COLUMN IF NOT EXISTS no_count INTEGER,
  ADD COLUMN IF NOT EXISTS na_count INTEGER,
  ADD COLUMN IF NOT EXISTS others TEXT,
  ADD COLUMN IF NOT EXISTS concerns_recommendations TEXT,
  ADD COLUMN IF NOT EXISTS deviations_photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updates TEXT,
  ADD COLUMN IF NOT EXISTS updates_attachment_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature1_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS signature1_name TEXT,
  ADD COLUMN IF NOT EXISTS signature1_position TEXT,
  ADD COLUMN IF NOT EXISTS signature2_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS signature2_name TEXT,
  ADD COLUMN IF NOT EXISTS signature2_position TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;

UPDATE public.users SET email = lower(trim(email)) WHERE email IS NOT NULL;
UPDATE public.users SET assigned_stores = '[]'::jsonb WHERE assigned_stores IS NULL;
UPDATE public.tickets SET image_urls = '[]'::jsonb WHERE image_urls IS NULL;
UPDATE public.tickets SET handling_history = '[]'::jsonb WHERE handling_history IS NULL;
UPDATE public.ticket_comments SET attachment_urls = '[]'::jsonb WHERE attachment_urls IS NULL;

COMMIT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- A public bucket already permits access through getPublicUrl(). Do not add a
-- SELECT policy: it would also let API clients enumerate every stored file.
DROP POLICY IF EXISTS "attachments public read" ON storage.objects;

DROP POLICY IF EXISTS "attachments authenticated upload" ON storage.objects;
CREATE POLICY "attachments authenticated upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments authenticated update" ON storage.objects;
CREATE POLICY "attachments authenticated update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'attachments'
  AND owner_id = (SELECT auth.uid()::text)
);

DROP POLICY IF EXISTS "attachments authenticated delete" ON storage.objects;
CREATE POLICY "attachments authenticated delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND owner_id = (SELECT auth.uid()::text)
);

-- Admin CRUD compatibility fixes (safe to run more than once)
BEGIN;

ALTER TABLE public.pending_users
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS app_role TEXT,
  ADD COLUMN IF NOT EXISTS brand_id TEXT;

-- The original export stored users.disabled as text. Convert it to a real boolean
-- so values such as 'false' are not treated as truthy by the React application.
ALTER TABLE public.users
  ALTER COLUMN disabled DROP DEFAULT;
ALTER TABLE public.users
  ALTER COLUMN disabled TYPE BOOLEAN
  USING CASE
    WHEN disabled IS NULL THEN FALSE
    WHEN lower(trim(disabled::text)) IN ('true','t','1','yes','y') THEN TRUE
    ELSE FALSE
  END;
ALTER TABLE public.users
  ALTER COLUMN disabled SET DEFAULT FALSE;

UPDATE public.users
SET email = lower(trim(email)), assigned_stores = COALESCE(assigned_stores, '[]'::jsonb)
WHERE email IS NOT NULL;

-- Prevent duplicate application profiles that can cause blank screens and
-- unpredictable admin edit/delete behavior.
DELETE FROM public.users a
USING public.users b
WHERE lower(trim(a.email)) = lower(trim(b.email))
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
ON public.users (lower(trim(email)))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pending_users_email_lower_unique
ON public.pending_users (lower(trim(email)))
WHERE email IS NOT NULL;

COMMIT;

-- Ticket and audit workflow compatibility fixes
BEGIN;
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS audit_submission_id TEXT,
  ADD COLUMN IF NOT EXISTS audit_template_id TEXT;

ALTER TABLE public.audit_submissions
  ALTER COLUMN submission_date SET DEFAULT now();

UPDATE public.audit_submissions
SET submission_date = COALESCE(submission_date, created_date, now())
WHERE submission_date IS NULL;

CREATE INDEX IF NOT EXISTS tickets_audit_submission_idx ON public.tickets(audit_submission_id);
CREATE INDEX IF NOT EXISTS tickets_submitter_email_idx ON public.tickets(lower(submitter_email));
CREATE INDEX IF NOT EXISTS tickets_handling_department_idx ON public.tickets(handling_department_id);
CREATE INDEX IF NOT EXISTS audit_submissions_submitter_idx ON public.audit_submissions(lower(submitted_by_email));
COMMIT;
