-- Figaro HelpDesk installation verification.
-- Run after helpdesk_supabase_local.sql and complete_setup.sql.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'users','brands','stores','departments','categories','slas','canned_responses',
    'ticket_rules','pending_users','checklist_configs','audit_templates','audit_assignments',
    'tickets','ticket_comments','ticket_feedback','notifications','audit_submissions'
  )
order by table_name;

select id as bucket_id, name, public
from storage.buckets
where id = 'attachments';

select
  (select count(*) from public.users) as users,
  (select count(*) from public.departments) as departments,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.tickets) as tickets,
  (select count(*) from public.audit_templates) as audit_templates,
  (select count(*) from public.audit_submissions) as audit_submissions;

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tickets'
  and column_name in (
    'id','title','description','status','priority','approval_status','submitter_email',
    'department_id','category_id','assigned_to','audit_submission_id','audit_template_id'
  )
order by column_name;
