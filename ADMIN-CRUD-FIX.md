# Admin CRUD Fix

Run `supabase/complete_setup.sql` again in Supabase SQL Editor after upgrading.
It is designed to be safe on an existing database and adds the admin CRUD compatibility changes.

## User creation

Admin > Users now creates the Supabase Authentication account through an isolated client and then creates or updates the matching `public.users` profile. The administrator remains logged in.

Supabase Authentication must allow email sign-ups. If **Confirm email** is enabled, the new user must confirm the email before first login.

## User deletion

Deleting a user from Admin performs a soft delete (`disabled = true`). The user is removed from the active Users list and is blocked from logging in. Re-adding the same email restores the profile.

## Verified build

The project successfully completed `npm run build` with Vite 6.4.3.
