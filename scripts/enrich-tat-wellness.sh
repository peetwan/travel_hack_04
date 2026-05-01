#!/usr/bin/env bash
# Curl-based enrichment for data/wellness_local.json — mirrors enrich-tat.sh
# (the gems pipeline) because Node fetch hits a Cloudflare BKK edge that
# returns empty results, while curl resolves to SIN where keyword search works.
#
# Output: /tmp/tat_enrich_wellness.json (JSONL of {venue_id, tat: {...}}).

set -euo pipefail
cd "$(dirname "$0")/.."

export TAT_API_KEY=$(grep -E '^TAT_API_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
: "${TAT_API_KEY:?TAT_API_KEY missing}"

venues_payload=$(node --eval "
const data = require('./data/wellness_local.json');
for (const v of data) {
  const enc = (s) => encodeURIComponent(s.replace(/\s*[(–-].*/u, '').trim());
  console.log([v.id, enc(v.name_th), enc(v.name_en)].join('\t'));
}
")

echo "[]" > /tmp/tat_enrich_wellness.json

while IFS=$'\t' read -r venue_id name_th_enc name_en_enc; do
  for keyword in "$name_th_enc" "$name_en_enc"; do
    [ -z "$keyword" ] && continue
    body=$(curl -sS --max-time 8 \
      "https://tatdataapi.io/api/v2/places?keyword=${keyword}&pageSize=5" \
      -H "x-api-key: ${TAT_API_KEY}" || echo '{"data":[]}')

    found=$(echo "$body" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', [])
    if items:
        c = items[0]
        out = {
            'place_id': c['placeId'],
            'name_th': c['name'],
            'slug': c.get('slug', ''),
            'thumbnail_url': (c.get('thumbnailUrl') or [None])[0],
            'viewer': c.get('viewer', 0),
            'province_th': (c.get('location', {}).get('province') or {}).get('name', ''),
        }
        print(json.dumps(out, ensure_ascii=False))
except Exception:
    pass
")
    if [ -n "$found" ]; then
      echo "✓ $venue_id → $found"
      TAT_FOUND="$found" VENUE_ID="$venue_id" python3 -c "
import json, os
with open('/tmp/tat_enrich_wellness.json') as f:
    arr = json.load(f)
arr.append({'venue_id': os.environ['VENUE_ID'], 'tat': json.loads(os.environ['TAT_FOUND'])})
with open('/tmp/tat_enrich_wellness.json','w') as f:
    json.dump(arr, f, ensure_ascii=False, indent=2)
"
      break
    fi
  done

  if [ -z "${found:-}" ]; then
    echo "✗ $venue_id"
  fi
  sleep 0.4
done <<< "$venues_payload"

echo ""
echo "Saved enrichments to /tmp/tat_enrich_wellness.json"
python3 -c "
import json
with open('/tmp/tat_enrich_wellness.json') as f:
    arr = json.load(f)
print(f'Total enriched: {len(arr)}')
"
