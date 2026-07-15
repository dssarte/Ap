# HelpDesk Pro - macOS + Supabase

## 1. Supabase database
Run these files in Supabase SQL Editor in this order:

1. `supabase/helpdesk_supabase_local.sql`
2. `supabase/complete_setup.sql`

In Authentication > URL Configuration set:

- Site URL: `http://localhost:5173`
- Redirect URL: `http://localhost:5173/reset-password`

Create login accounts in Authentication > Users using the same email addresses stored in `public.users`. Imported profile rows do not include passwords.

## 2. Environment
Copy `.env.example` to `.env.local` and enter the Supabase URL and anon key.

```bash
cp .env.example .env.local
```

## 3. Install and run on Mac
Double-click `setup-mac.command`, then double-click `run-mac.command`.

Terminal alternative:

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

## Main corrections

- Supabase login/profile matching for all roles, including admin accounts.
- Password reset uses Supabase recovery sessions.
- Blank-page error boundary with visible diagnostic message.
- Safe handling of invalid imported dates and SLA dates.
- Ticket, approval, audit, notification and upload compatibility layer.
- Required missing audit, rules and canned-response database columns.
- Public attachment bucket with authenticated upload policies.

## Note
Email reset rate limits are controlled by Supabase. Configure Custom SMTP for production use.
