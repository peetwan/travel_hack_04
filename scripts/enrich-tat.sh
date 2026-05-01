#!/usr/bin/env bash
# Curl-based enrichment because Node fetch hits a Cloudflare BKK edge that
# returns empty results, while curl resolves to SIN where keyword search works.
# Reads TAT_API_KEY from .env.local. Outputs JSONL of {gem_id, tat: {...}}
# that we then merge into data/hidden_gems.json with a tiny Node helper.

set -euo pipefail
cd "$(dirname "$0")/.."

export TAT_API_KEY=$(grep -E '^TAT_API_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
: "${TAT_API_KEY:?TAT_API_KEY missing}"

# (gem_id, name_th_url_encoded, name_en_url_encoded) — we generate these from JSON.
gems_payload=$(node --eval "
const data = require('./data/hidden_gems.json');
for (const g of data) {
  const enc = (s) => encodeURIComponent(s.replace(/\s*[(–-].*/u, '').trim());
  console.log([g.id, enc(g.name_th), enc(g.name_en)].join('\t'));
}
")

echo "[]" > /tmp/tat_enrich.json

while IFS=$'\t' read -r gem_id name_th_enc name_en_enc; do
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
      echo "✓ $gem_id → $found"
      TAT_FOUND="$found" GEM_ID="$gem_id" python3 -c "
import json, os
with open('/tmp/tat_enrich.json') as f:
    arr = json.load(f)
arr.append({'gem_id': os.environ['GEM_ID'], 'tat': json.loads(os.environ['TAT_FOUND'])})
with open('/tmp/tat_enrich.json','w') as f:
    json.dump(arr, f, ensure_ascii=False, indent=2)
"
      break
    fi
  done

  if [ -z "${found:-}" ]; then
    echo "✗ $gem_id"
  fi
  sleep 0.4
done <<< "$gems_payload"

echo ""
echo "Saved enrichments to /tmp/tat_enrich.json"
python3 -c "
import json
with open('/tmp/tat_enrich.json') as f:
    arr = json.load(f)
print(f'Total enriched: {len(arr)}')
"
