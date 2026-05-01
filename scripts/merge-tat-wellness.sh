#!/usr/bin/env bash
# For each enrichment in /tmp/tat_enrich_wellness.json, fetch the place's full
# details via curl (Node fetch hits a Cloudflare BKK edge that 400s on details)
# and validate that the TAT lat/lng is within 50km of our recorded coordinates.
# Then merge the validated entries into data/wellness_local.json.

set -euo pipefail
cd "$(dirname "$0")/.."

export TAT_API_KEY=$(grep -E '^TAT_API_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
: "${TAT_API_KEY:?TAT_API_KEY missing}"

> /tmp/tat_validated_wellness.jsonl

while IFS= read -r enrichment; do
  venue_id=$(echo "$enrichment" | python3 -c "import sys,json;print(json.load(sys.stdin)['venue_id'])")
  place_id=$(echo "$enrichment" | python3 -c "import sys,json;print(json.load(sys.stdin)['tat']['place_id'])")

  detail=$(curl -sS --max-time 8 \
    "https://tatdataapi.io/api/v2/places/${place_id}" \
    -H "x-api-key: ${TAT_API_KEY}" || echo '{}')

  result=$(echo "$detail" | python3 scripts/_tat_validate_wellness.py "$venue_id")

  if [[ "$result" == OK:* ]]; then
    tat_json="${result#OK:}"
    echo "✓ $venue_id → ${place_id} ($(echo "$tat_json" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["name_th"], f"{d[\"distance_km\"]}km, sha={d[\"sha_certified\"]}")'))"
    echo "{\"venue_id\":\"$venue_id\",\"tat\":$tat_json}" >> /tmp/tat_validated_wellness.jsonl
  else
    echo "✗ $venue_id — ${result#FAIL:}"
  fi

  sleep 0.2
done < <(python3 -c "
import json
arr = json.load(open('/tmp/tat_enrich_wellness.json'))
for e in arr:
    print(json.dumps(e, ensure_ascii=False))
")

echo ""
python3 scripts/_tat_merge_wellness.py
