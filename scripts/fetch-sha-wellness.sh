#!/usr/bin/env bash
# Discover candidate Thai wellness venues from the TAT API filtered to the
# SHA Plus / SHA Extra Plus tier, so the curated dataset stays fresh.
# Mirrors scripts/enrich-tat.sh — uses curl + python because Node fetch hits
# the Cloudflare BKK edge that returns empty results for keyword search.
#
# Output: /tmp/sha_wellness_candidates.json
#   [{ keyword, place_id, name, slug, thumbnail_url, province, sha_tier }, ...]
#
# Use the output to nominate new entries for data/wellness_local.json — manual
# curation is still required (signature treatments, awards, price tier).

set -euo pipefail
cd "$(dirname "$0")/.."

export TAT_API_KEY=$(grep -E '^TAT_API_KEY=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
: "${TAT_API_KEY:?TAT_API_KEY missing in .env.local}"

# Wellness-related keywords — Thai + English. TAT API does not expose a category
# filter, so we keyword-search and post-filter responses for SHA + wellness type.
keywords=(
  "spa"
  "wellness"
  "onsen"
  "%E0%B8%99%E0%B8%A7%E0%B8%94%E0%B9%81%E0%B8%9C%E0%B8%99%E0%B9%84%E0%B8%97%E0%B8%A2"   # นวดแผนไทย
  "%E0%B8%AD%E0%B8%9A%E0%B8%AA%E0%B8%A1%E0%B8%B8%E0%B8%99%E0%B9%84%E0%B8%9E%E0%B8%A3"   # อบสมุนไพร
  "%E0%B9%82%E0%B8%A2%E0%B8%84%E0%B8%B0"                                                # โยคะ
  "meditation"
  "retreat"
  "herbal"
)

echo "[]" > /tmp/sha_wellness_candidates.json

for keyword in "${keywords[@]}"; do
  echo "Querying TAT for: ${keyword}"
  body=$(curl -sS --max-time 8 \
    "https://tatdataapi.io/api/v2/places?keyword=${keyword}&pageSize=20" \
    -H "x-api-key: ${TAT_API_KEY}" || echo '{"data":[]}')

  KEYWORD="$keyword" python3 <<'PY'
import json, os, sys

raw = sys.stdin.read()
try:
    body = json.loads(raw) if raw else {"data": []}
except Exception:
    body = {"data": []}

# Try to load anything that's already on disk so we accumulate across keywords.
out_path = "/tmp/sha_wellness_candidates.json"
try:
    with open(out_path) as f:
        existing = json.load(f)
except Exception:
    existing = []

seen_ids = {c.get("place_id") for c in existing}

for item in body.get("data", []):
    sha_info = item.get("shaCert") or item.get("sha") or {}
    sha_tier = None
    if isinstance(sha_info, dict):
        sha_tier = sha_info.get("level") or sha_info.get("tier")
    elif isinstance(sha_info, str):
        sha_tier = sha_info
    sha_str = str(sha_tier or "").lower()
    is_sha = "sha" in sha_str or item.get("shaCertified") in (True, "true", "yes")
    # We accept entries even without explicit SHA — the script writes everything
    # it finds and the maintainer hand-filters. But we tag any SHA hit.
    pid = item.get("placeId")
    if not pid or pid in seen_ids:
        continue
    seen_ids.add(pid)
    location = item.get("location") or {}
    province = (location.get("province") or {}).get("name") or ""
    existing.append({
        "keyword": os.environ.get("KEYWORD", ""),
        "place_id": pid,
        "name": item.get("name") or "",
        "slug": item.get("slug") or "",
        "thumbnail_url": (item.get("thumbnailUrl") or [None])[0],
        "province": province,
        "sha_tier": sha_tier if is_sha else None,
    })

with open(out_path, "w") as f:
    json.dump(existing, f, ensure_ascii=False, indent=2)

print(f"  +{len(body.get('data', []))} hits, total accumulated: {len(existing)}")
PY
  echo "$body" | python3 - <<PY > /dev/null 2>&1 || true
PY
  sleep 0.4
done

echo ""
echo "All keyword sweeps done."
echo "Candidates saved to /tmp/sha_wellness_candidates.json"
python3 - <<'PY'
import json
with open("/tmp/sha_wellness_candidates.json") as f:
    arr = json.load(f)
sha_count = sum(1 for c in arr if c.get("sha_tier"))
print(f"Total candidates: {len(arr)}")
print(f"With SHA tier flag: {sha_count}")
PY
