# Reset ticket and audit data

Use [supabase/reset_transactional_data.sql](supabase/reset_transactional_data.sql) to clear the application's operational history without deleting configuration.

## Before running it

1. Open the Supabase project.
2. Create a database backup or confirm that a current backup exists.
3. Open `reset_transactional_data.sql`.
4. Paste and run the complete script in the Supabase SQL Editor. The file is already unlocked and will delete the listed records immediately.
5. Confirm that the final result shows zero for all five tables.

## Data removed

- Tickets
- Ticket comments and internal discussions
- Ticket feedback
- Ticket-linked notifications
- Audit submissions and reports generated from those submissions

## Data preserved

- Supabase authentication accounts
- User profiles and roles
- Departments and categories
- SLA policies and ticket rules
- Canned responses
- Brands and stores
- Audit templates and assignments
- Checklist configuration

## Uploaded files

The database reset does not remove uploaded images and attachments from Supabase Storage. If those files must also be removed, empty the `attachments` bucket separately from the Supabase Storage dashboard after confirming the backup. Do not delete the bucket itself because the application still uses it for new uploads.

Users with saved audit drafts may also need to discard those drafts when prompted, because drafts are stored in each browser rather than in Supabase.
