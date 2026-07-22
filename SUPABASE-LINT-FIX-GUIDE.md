# Supabase lint fixes

The exported lint report contains 19 warnings:

- 17 `rls_policy_always_true` warnings caused by `local_testing_all`.
- 1 `public_bucket_allows_listing` warning for the `attachments` bucket.
- 1 `auth_leaked_password_protection` warning.

## Apply the database fixes

1. Back up the production database.
2. Open the Supabase SQL Editor.
3. Run the entire `supabase/harden_rls_policies.sql` file.
4. Confirm both verification queries at the bottom return zero rows.

The script does not delete application data. It replaces unrestricted table
access with role/ownership policies and removes the attachment-listing policy.
The bucket stays public, so existing attachment URLs continue to work.

## Enable leaked-password protection

This warning is an Auth project setting and cannot be changed by the RLS SQL.

1. Open the Supabase project dashboard.
2. Go to **Authentication** and open the password/security settings.
3. Enable **Leaked password protection**.
4. Save the Auth settings.

Supabase currently provides leaked-password protection on Pro plans and above.
Existing passwords are not deleted or automatically changed. New passwords and
password changes are checked against known compromised passwords.

## Verify

Open **Advisors > Security Advisor** and select **Rerun linter**. The export's 19
warnings should be cleared after the SQL changes and Auth setting are applied.

Test these workflows after applying production access policies:

- Admin configuration and user management.
- Regular user ticket creation and comments.
- Approver approval/rejection.
- Department-head assignment, forwarding, and status changes.
- Store-manager audit and approval views.
- Attachment upload and display.
