#!/usr/bin/env bash
# Regenerates backend/packaging/macos/AppIcon.icns from frontend/public/logo.svg.
# Run this whenever the logo changes; the .icns itself is committed (macOS-only tools,
# not something CI/build.sh should have to regenerate on every build).
#
# The source SVG's viewBox is 25x21 (not square) — the pixel-star's horizontal rays reach
# the left/right edges, so squaring it by naive stretch would distort the star. Instead we
# pad the viewBox vertically (2 units top + bottom) to make it 25x25, keeping every pixel's
# coordinates untouched, then rasterize that square canvas at each required icon resolution.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="frontend/public/logo.svg"
OUT_DIR="backend/packaging/macos"
ICONSET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$ICONSET" "$OUT_DIR"

SQUARE_SVG="$(mktemp -d)/logo-square.svg"
sed -E 's/viewBox="0 0 25 21"/viewBox="0 -2 25 25"/; s/width="275" height="231"/width="275" height="275"/' "$SRC" > "$SQUARE_SVG"

for size in 16 32 128 256 512; do
  sips -s format png -Z "$size" "$SQUARE_SVG" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -Z "$double" "$SQUARE_SVG" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET" -o "$OUT_DIR/AppIcon.icns"
echo "==> Wrote $OUT_DIR/AppIcon.icns"
