#!/usr/bin/env bash
# Wraps a built SanringMonitor.app into a distributable .dmg — the standard macOS "drag into
# Applications" install experience, instead of sharing the raw .app folder zipped up.
#
# Separate from build.sh on purpose (like make-icns.sh): packaging for distribution is slower
# and not something you want on every dev build/test cycle, only when you actually need a
# shareable artifact. Run build.sh first (it assembles the .app), then this.
#
# Usage: ./scripts/make-dmg.sh [publish-dir]   # default: publish/current
set -euo pipefail
cd "$(dirname "$0")/.."

PUBLISH_DIR="${1:-publish/current}"
APP_DIR="$PUBLISH_DIR/SanringMonitor.app"
OUT_DMG="$PUBLISH_DIR/SanringMonitor.dmg"

if [ ! -d "$APP_DIR" ]; then
  echo "找不到 $APP_DIR ——先跑 ./scripts/build.sh（在 macOS 上，或指定 osx-* RID）產生 .app" >&2
  exit 1
fi

STAGING="$(mktemp -d)/dmg-staging"
mkdir -p "$STAGING"
cp -R "$APP_DIR" "$STAGING/"
# 標準拖曳安裝體驗的核心：跟 .app 並排放一個指到 /Applications 的捷徑，使用者掛載後把左邊
# 圖示拖到右邊圖示就完成安裝——不做這個的話只是「多一層殼」，跟直接分享 .app 資料夾沒兩樣。
ln -s /Applications "$STAGING/Applications"

rm -f "$OUT_DMG"
hdiutil create -volname "SanRing Usage Monitor" -srcfolder "$STAGING" -ov -format UDZO "$OUT_DMG"

echo "==> Wrote $OUT_DMG"
