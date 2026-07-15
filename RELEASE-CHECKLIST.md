# Figaro HelpDesk Supabase Release Checklist

## Automated checks completed
- npm dependency installation
- ESLint with zero errors
- JavaScript project typecheck configuration
- Vite production build
- Entity/function compatibility scan for all pages

## Required Supabase configuration
1. Run `supabase/helpdesk_supabase_local.sql` on a new database.
2. Run `supabase/complete_setup.sql` on both new and existing databases.
3. Run `supabase/verify_installation.sql` and confirm all 17 tables and the `attachments` bucket are returned.
4. Authentication Site URL: `http://localhost:5173`.
5. Redirect URL: `http://localhost:5173/reset-password`.
6. For production, configure Custom SMTP. Supabase test email limits can block password reset and verification emails.

## Acceptance test
- Login as admin and regular user.
- Add, edit, disable, and restore a user.
- Create, approve, assign, comment on, resolve, and delete/close a ticket.
- Create/edit/delete departments, categories, SLA policies, responses, rules, brands, stores, templates, and assignments.
- Submit an audit with Yes/No answers, photos, signature, and failed-item ticket creation.
- Request a password reset and set a new password using the newest email link.

Browser and live database acceptance tests require the target Supabase project credentials and cannot be performed by the source build alone.
