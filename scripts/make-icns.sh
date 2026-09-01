#!/usr/bin/env bash
# Regenerates backend/packaging/macos/AppIcon.icns from backend/packaging/macos/icon-source.svg.
# Run this whenever the app icon changes; the .icns itself is committed (macOS-only tools,
# not something CI/build.sh should have to regenerate on every build).
#
# icon-source.svg is deliberately a separate file from frontend/public/logo.svg (the in-app
# header logo) — the app icon needs its own filled background (a Dock icon floating on
# transparency looks wrong), so it's the "plate" variant of the mark, not the transparent one
# used in the UI. Already a square 16x16 viewBox with its own background rect, so unlike the
# old pixel-star source this needs no padding step before rasterizing.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="backend/packaging/macos/icon-source.svg"
OUT_DIR="backend/packaging/macos"
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$ICONSET"

for size in 16 32 128 256 512; do
  sips -s format png -Z "$size" "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -Z "$double" "$SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT_DIR/AppIcon.icns"
echo "==> Wrote $OUT_DIR/AppIcon.icns"
