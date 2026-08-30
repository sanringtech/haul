#!/usr/bin/env bash
# Runs the Angular dev server and the Photino/C# host together.
# The window loads http://localhost:4200 so Angular's hot reload works.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd frontend && npm start -- --port 4200) &
FRONTEND_PID=$!
trap 'kill $FRONTEND_PID 2>/dev/null || true' EXIT

echo "Waiting for Angular dev server on http://localhost:4200 ..."
until curl -sf http://localhost:4200 > /dev/null; do sleep 0.5; done

USAGEMONITOR_DEV_SERVER_URL=http://localhost:4200 dotnet run --project backend
