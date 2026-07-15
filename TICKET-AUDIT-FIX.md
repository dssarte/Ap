# Ticket and Audit workflow fixes

- Ticket creation validates department/category/title/description and saves assigned user.
- Ticket creation now creates notifications and applies local rules.
- Local SLA calculation now updates response/resolution due dates.
- Ticket notifications are stored in Supabase for submitter, assignee, approver and department staff.
- Audit submission uses try/catch/finally and no longer remains stuck on Saving after an error.
- Active Ticket audit templates now create approved/open tickets for every section with NO answers.
- Audit-generated tickets link back to the audit submission and template.
- Added indexes and missing linkage columns in complete_setup.sql.
