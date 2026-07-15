# HelpDesk Pro - Local PC + Supabase

## Requirements
- Node.js 20 LTS or newer
- A Supabase project

## 1. Install database
1. Open Supabase Dashboard > SQL Editor.
2. Run `supabase/helpdesk_supabase_local.sql`.
3. Open Storage and create a public bucket named `attachments`.
4. Open Authentication > Providers > Email and enable Email/Password.

## 2. Configure the application
1. Copy `.env.example` to `.env.local`.
2. Put your Supabase Project URL and anon/public key in `.env.local`.

## 3. Run on the local PC
```bash
npm install
npm run dev
```
Open the URL shown by Vite, normally http://localhost:5173.

## 4. Create login accounts
Imported records in `public.users` are profile data only. Passwords cannot be exported from Base44.
Create users in Supabase Dashboard > Authentication > Users using the same email address as the imported `public.users` record. The application links the login to the profile by email.

## Notes
- Database CRUD, authentication, realtime subscriptions, and file uploads now use Supabase.
- Email and custom server functions require Supabase Edge Functions. Calls are preserved through `supabase.functions.invoke()`.
- The included SQL uses permissive policies for initial testing. Tighten RLS policies before production deployment.
