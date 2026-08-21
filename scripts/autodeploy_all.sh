#!/bin/bash
# Rebuilds every collection and redeploys to Netlify whenever the total
# published entry count grows by at least MIN_DELTA. Run detached.
#
#   MIN_DELTA=100 nohup ./scripts/autodeploy_all.sh &
#
# Counts Zakariyya translations (data/en/*.md) plus Mahmudiyyah entries
# (data/mahmudiyyah/source.json), so work on either collection triggers a deploy.
cd "$(dirname "$0")/.." || exit 1
MIN_DELTA=${MIN_DELTA:-100}
INTERVAL=${INTERVAL:-300}
TOKEN_FILE=${TOKEN_FILE:-/tmp/.nlt}

count_all() {
  local en mm
  en=$(ls data/en 2>/dev/null | wc -l | tr -d ' ')
  mm=$(python3 -c "
import json,sys
try:
    print(len(json.load(open('data/mahmudiyyah/source.json'))['entries']))
except Exception:
    print(0)" 2>/dev/null)
  echo $((en + mm))
}

last=$(count_all)
echo "=== $(date '+%F %H:%M:%S') autodeploy watching (baseline $last, delta $MIN_DELTA) ===" \
  >> data/autodeploy.log

while true; do
  sleep "$INTERVAL"
  now=$(count_all)
  if [ "$((now - last))" -ge "$MIN_DELTA" ]; then
    {
      echo "=== $(date '+%F %H:%M:%S') rebuilding at $now entries ==="
      python3 scripts/build_site.py
      python3 scripts/build_mahmudiyyah.py
      ./node_modules/.bin/tailwindcss -i ./src/input.css -o ./public/styles.css --minify 2>/dev/null \
        || npx --no-install @tailwindcss/cli -i ./src/input.css -o ./public/styles.css --minify

      if [ -r "$TOKEN_FILE" ]; then
        NETLIFY_AUTH_TOKEN=$(cat "$TOKEN_FILE") ./node_modules/.bin/netlify deploy \
          --prod --dir=public --message "$now entries published" 2>&1 \
          | grep -E "Deploy is live|Production URL|Error"
      else
        echo "no token at $TOKEN_FILE — skipping deploy"
      fi
    } >> data/autodeploy.log 2>&1
    last="$now"
  fi
done
