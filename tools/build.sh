#!/bin/sh
# Bundles src/ into one self-contained, playable cc/index.html (Crush Commando on its own).
# The combined game with Hollow Dash and multiplayer is ../index.html, which loads this in a frame.
set -e
cd "$(dirname "$0")/.."
mkdir -p cc
{
  echo '<!doctype html>'
  echo '<html lang="en"><head>'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  cat src/head.html
  echo '<script>'
  for f in core chunks levelgen audio render entities bosses fps combat story net main; do cat "src/$f.js"; done
  echo '</script>'
  echo '</body></html>'
} > cc/index.html
echo "built cc/index.html ($(wc -c < cc/index.html) bytes)"
