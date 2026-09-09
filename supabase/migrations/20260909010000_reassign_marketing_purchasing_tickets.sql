-- One-time data fix: move existing tickets that were auto-routed to the old
-- "Marketing/Purchasing" department over to the "Purchasing" department, now
-- that the OD checklist's section title was renamed from "Marketing/Purchasing"
-- to "Purchasing" (which is what audit-triggered tickets match against —
-- see Audit.jsx's section-title-to-department lookup). Without this, tickets
-- created before the rename still point at the old department and never
-- show up in Purchasing's queue.
--
-- Run the SELECT preview first and confirm the counts/names look right
-- before running the UPDATE section below.

-- ============ STEP 1: PREVIEW (read-only, safe to run first) ============
select
  d_old.id as old_department_id,
  d_old.name as old_department_name,
  d_new.id as new_department_id,
  d_new.name as new_department_name,
  (select count(*) from public.tickets where department_id = d_old.id) as tickets_by_department_id,
  (select count(*) from public.tickets where handling_department_id = d_old.id) as tickets_by_handling_department_id
from public.departments d_old
cross join public.departments d_new
where d_old.name ilike '%marketing%purchasing%'
  and d_new.name = 'Purchasing';

-- ============ STEP 2: THE ACTUAL UPDATE (run only after STEP 1 looks right) ============
-- BEGIN;
--
-- with old_dept as (
--   select id from public.departments where name ilike '%marketing%purchasing%'
-- ),
-- new_dept as (
--   select id from public.departments where name = 'Purchasing'
-- )
-- update public.tickets
-- set
--   department_id = (select id from new_dept),
--   department_name = 'Purchasing'
-- where department_id = (select id from old_dept);
--
-- with old_dept as (
--   select id from public.departments where name ilike '%marketing%purchasing%'
-- ),
-- new_dept as (
--   select id from public.departments where name = 'Purchasing'
-- )
-- update public.tickets
-- set
--   handling_department_id = (select id from new_dept),
--   handling_department_name = 'Purchasing'
-- where handling_department_id = (select id from old_dept);
--
-- COMMIT;
