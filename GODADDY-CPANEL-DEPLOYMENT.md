# Production deployment: audit.thefigarogroup.ph

## Architecture

- Website: GoDaddy cPanel static hosting
- Frontend: React + Vite
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth
- Attachments: Supabase Storage
- Production URL: `https://audit.thefigarogroup.ph`

## 1. Create the subdomain in GoDaddy cPanel

1. Open GoDaddy Hosting > cPanel Admin.
2. Open **Domains** or **Subdomains**.
3. Create `audit.thefigarogroup.ph`.
4. Note the document root. A typical value is `public_html/audit`.
5. Enable the free SSL certificate and wait until HTTPS is active.

## 2. Configure the production environment

From the project folder:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and enter your Supabase project URL and public anon/publishable key.
Never use the Supabase service-role key in frontend files.

## 3. Build the deployment package

```bash
npm install
npm run build:cpanel
```

The command runs lint, type checking, and a production build. It creates:

```text
cpanel-deploy/
```

## 4. Upload to GoDaddy

1. Open cPanel **File Manager**.
2. Open the document root of `audit.thefigarogroup.ph`.
3. Remove any default placeholder file such as `index.html`.
4. Upload all files and folders *inside* `cpanel-deploy`.
5. Confirm `.htaccess` was uploaded. Enable **Show Hidden Files** in File Manager if necessary.

Expected root contents include:

```text
.htaccess
index.html
assets/
```

## 5. Configure Supabase Auth URLs

In Supabase, open **Authentication > URL Configuration**.

Set Site URL:

```text
https://audit.thefigarogroup.ph
```

Add Redirect URLs:

```text
https://audit.thefigarogroup.ph/**
https://audit.thefigarogroup.ph/reset-password
http://localhost:5173/**
http://localhost:5173/reset-password
```

Keep the localhost entries for development.

## 6. Verify Supabase Storage

Confirm the `attachments` bucket exists and that the storage policies from `supabase/complete_setup.sql` were applied.

## 7. Production acceptance test

Test with one Admin, one Approver/Manager, and one regular user:

- Login and logout
- Forgot password and reset password
- Admin user add/edit/disable
- Department/category/store/brand CRUD
- Ticket create, upload, approval, assignment, comment, status, and resolution
- Audit template create/edit
- Audit assignment and submission
- Photo/signature upload
- Automatic ticket creation for failed audit items
- Reports and dashboards
- Direct refresh of routes such as `/Admin`, `/Audit`, and `/reset-password`

## Updating the website later

Run:

```bash
npm run build:cpanel
```

Then replace the files in the subdomain document root with the new `cpanel-deploy` contents. Keep a backup of the previous deployment before replacing it.
