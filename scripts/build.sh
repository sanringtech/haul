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
  # 一定要先清空：這裡不是乾淨目錄——make-dmg.sh 會把 .dmg 直接寫進同一個 publish/<rid>/
  # 資料夾，上一輪產生的 .dmg（或任何殘留檔案）如果還在，下面「把 publish 目錄裡除了 .app
  # 以外的東西都掃進 Contents/MacOS/」那步會連它一起掃進去，變成 .dmg 包 .dmg（2026-09-01
  # 實測踩到：.app 從正常的幾十 MB 膨脹到 191MB）。dotnet publish 本身只會疊加/覆蓋，不會
  # 幫忙清掉這種不是它自己產出的雜物，得自己保證起手是空的。
  rm -rf "$PUBLISH_DIR"
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
  rm -rf "$PUBLISH_DIR"
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
