@echo off
setlocal
if not exist .env.local (
  echo Missing .env.local. Run setup-windows.bat first.
  pause
  exit /b 1
)
call npm run dev -- --host 0.0.0.0
pause
