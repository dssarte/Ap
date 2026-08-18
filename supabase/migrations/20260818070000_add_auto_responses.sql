-- Replaces the old Canned Responses admin tab with per-department Auto
-- Responses: an active-hours window during which a matching new ticket gets
-- an automatic comment posted on it.

BEGIN;

CREATE TABLE IF NOT EXISTS public.auto_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id text NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  department_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  start_time text NOT NULL DEFAULT '00:00',
  end_time text NOT NULL DEFAULT '23:59',
  is_active boolean NOT NULL DEFAULT true,
  created_date timestamptz NOT NULL DEFAULT now(),
  updated_date timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auto_responses_department_id_idx ON public.auto_responses (department_id);

ALTER TABLE public.auto_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_responses_select ON public.auto_responses;
CREATE POLICY auto_responses_select ON public.auto_responses
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS auto_responses_admin_write ON public.auto_responses;
CREATE POLICY auto_responses_admin_write ON public.auto_responses
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

COMMIT;
