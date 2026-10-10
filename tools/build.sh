#!/bin/sh
# Bundles src/ into one self-contained, playable index.html.
set -e
cd "$(dirname "$0")/.."
{
  echo '<!doctype html>'
  echo '<html lang="en"><head>'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  cat src/head.html
  echo '<script>'
  for f in core chunks levelgen audio render entities bosses fps combat story main; do cat "src/$f.js"; done
  echo '</script>'
  echo '</body></html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
