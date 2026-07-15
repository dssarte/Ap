#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -x node_modules/.bin/vite ]; then
  echo "Dependencies are missing. Running npm install..."
  npm config set registry https://registry.npmjs.org/
  npm install
fi
npm run dev -- --open
