import { existsSync, readFileSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env.production');
const examplePath = resolve(root, '.env.production.example');

if (!existsSync(envPath)) {
  console.error('Missing .env.production. Copy .env.production.example to .env.production and enter your Supabase values.');
  process.exit(1);
}

const env = readFileSync(envPath, 'utf8');
if (env.includes('YOUR_PROJECT_ID') || env.includes('YOUR_SUPABASE_ANON_KEY')) {
  console.error('.env.production still contains placeholder values.');
  process.exit(1);
}

execSync('npm run verify', { cwd: root, stdio: 'inherit' });

const deployDir = resolve(root, 'cpanel-deploy');
rmSync(deployDir, { recursive: true, force: true });
mkdirSync(deployDir, { recursive: true });
cpSync(resolve(root, 'dist'), deployDir, { recursive: true });

writeFileSync(resolve(deployDir, 'DEPLOYMENT-NOTE.txt'), [
  'Upload the CONTENTS of this folder to the document root of fcg.thefigarogroup.ph.',
  'Do not upload the cpanel-deploy folder itself as an extra nested directory.',
  '',
  'Before uploading this frontend:',
  '  1. Back up the production Supabase database.',
  '  2. Run supabase/harden_rls_policies.sql in the Supabase SQL Editor.',
  '  3. Run supabase/scale_for_200_stores.sql in the Supabase SQL Editor.',
  'The SQL files are kept outside the public web package for security.',
  '',
  'Supabase Site URL: https://fcg.thefigarogroup.ph',
  'Supabase Redirect URLs:',
  '  https://fcg.thefigarogroup.ph/**',
  '  https://fcg.thefigarogroup.ph/reset-password',
  '',
  'After upload, clear the CDN/browser cache and test every application role.',
].join('\n'));

console.log('\nProduction package created at: cpanel-deploy/');
console.log('Upload its contents to the subdomain document root in GoDaddy cPanel.');
