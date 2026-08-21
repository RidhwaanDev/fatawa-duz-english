#!/bin/bash
# Rebuilds site data and redeploys to Netlify whenever the translated count
# grows by at least MIN_DELTA. Run detached in the background.
cd "$(dirname "$0")/.." || exit 1
MIN_DELTA=${MIN_DELTA:-100}
last=$(ls data/en 2>/dev/null | wc -l | tr -d ' ')
while true; do
  sleep 300
  now=$(ls data/en 2>/dev/null | wc -l | tr -d ' ')
  if [ "$((now - last))" -ge "$MIN_DELTA" ]; then
    {
      echo "=== $(date '+%H:%M:%S') rebuilding at $now translated ==="
      python3 scripts/build_site.py
      NETLIFY_AUTH_TOKEN=$(cat /tmp/.nlt) ./node_modules/.bin/netlify deploy \
        --prod --dir=public --message "$now fatawa translated" 2>&1 \
        | grep -E "Deploy is live|Production URL|Error"
    } >> data/autodeploy.log 2>&1
    last="$now"
  fi
done
