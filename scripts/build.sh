#!/usr/bin/env bash
# Builds the Angular frontend and copies it into backend/wwwroot, then
# publishes the C# host as a self-contained app for the current OS/arch.
# For a different target, pass a .NET RID, e.g.: ./scripts/build.sh osx-arm64
set -euo pipefail
cd "$(dirname "$0")/.."

RID="${1:-}"

echo "==> Building Angular frontend"
# --base-href ./: index.html is loaded via file:// inside the Photino WebView, not served from
# "/" over http like a normal deploy. The default "/" base-href makes the browser resolve every
# asset (main-*.js, styles-*.css) against the filesystem root instead of the wwwroot/browser
# folder, so nothing loads and the window is just blank — this bit us once, don't remove it.
(cd frontend && npm run build -- --base-href ./)

echo "==> Copying frontend build into backend/wwwroot"
rm -rf backend/wwwroot
mkdir -p backend/wwwroot
cp -R frontend/dist/frontend/browser backend/wwwroot/browser

echo "==> Publishing backend"
if [ -n "$RID" ]; then
  dotnet publish backend -c Release -r "$RID" --self-contained true -o publish/"$RID"
else
  dotnet publish backend -c Release -o publish/current
fi

echo "Done."
