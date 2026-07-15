@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 20 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist .env.local (
  copy .env.example .env.local >nul
  echo Created .env.local. Edit it and enter your Supabase URL and anon key.
)
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)
echo Setup completed.
echo Edit .env.local, then run run-local.bat.
pause
