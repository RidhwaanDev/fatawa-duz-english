#!/bin/bash
# Rebuilds public/data/ whenever new translations land. Run in the background.
cd "$(dirname "$0")/.." || exit 1
last=""
while true; do
  now=$(ls data/en 2>/dev/null | wc -l | tr -d ' ')
  if [ "$now" != "$last" ]; then
    python3 scripts/build_site.py >> data/autobuild.log 2>&1
    last="$now"
  fi
  sleep 90
done
