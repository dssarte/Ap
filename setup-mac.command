#!/bin/bash
set -e
cd "$(dirname "$0")"
npm config set registry https://registry.npmjs.org/
npm config delete proxy >/dev/null 2>&1 || true
npm config delete https-proxy >/dev/null 2>&1 || true
rm -rf node_modules
npm install
printf '\nSetup complete. Double-click run-mac.command to start.\n'
read -r -p "Press Enter to close..."
