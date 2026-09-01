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
  PUBLISH_DIR="publish/$RID"
  PUBLISH_ARGS=(-c Release -r "$RID" --self-contained true -o "$PUBLISH_DIR")
  # Windows has no bundle-folder convention like macOS's .app — a single .exe *is* the cleanest
  # distributable there, so fold the whole self-contained runtime into one file (2026-08-31,
  # first real cross-compile: also caught that plain <OutputType>Exe> builds a console-subsystem
  # .exe on Windows — a black terminal window would pop up alongside the GUI on double-click —
  # fixed in SanringHaul.csproj by switching to WinExe for win-* RIDs, not here).
  [[ "$RID" == win-* ]] && PUBLISH_ARGS+=(-p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true)
  dotnet publish backend "${PUBLISH_ARGS[@]}"
  IS_MACOS_TARGET=false
  [[ "$RID" == osx-* ]] && IS_MACOS_TARGET=true
else
  PUBLISH_DIR="publish/current"
  dotnet publish backend -c Release -o "$PUBLISH_DIR"
  IS_MACOS_TARGET=false
  [[ "$(uname -s)" == "Darwin" ]] && IS_MACOS_TARGET=true
fi

if [ "$IS_MACOS_TARGET" = true ]; then
  # A bare `dotnet publish` output has no Dock/Finder icon on macOS — Photino's SetIconFile()
  # is documented as Windows/Linux-only, so the app icon has to come from a real .app bundle's
  # Info.plist + .icns instead (see backend/Program.cs's SetIconFile comment for the full story).
  echo "==> Assembling SanringHaul.app"
  APP_DIR="$PUBLISH_DIR/SanringHaul.app"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
  # Everything dotnet published (executable, dlls, wwwroot) moves under Contents/MacOS/ as one
  # unit — Photino resolves its relative Load()/asset paths against the executable's own
  # directory (AppContext.BaseDirectory), not the process's cwd, so this keeps that intact.
  find "$PUBLISH_DIR" -mindepth 1 -maxdepth 1 ! -name "SanringHaul.app" -exec mv {} "$APP_DIR/Contents/MacOS/" \;
  cp backend/packaging/macos/Info.plist "$APP_DIR/Contents/Info.plist"
  cp backend/packaging/macos/AppIcon.icns "$APP_DIR/Contents/Resources/AppIcon.icns"
  chmod +x "$APP_DIR/Contents/MacOS/SanringHaul"
  echo "==> Wrote $APP_DIR"
fi

echo "Done."
