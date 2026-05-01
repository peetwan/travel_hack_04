#!/usr/bin/env python3
"""Merge validated TAT enrichments into data/wellness_local.json."""
import json

with open("data/wellness_local.json", encoding="utf-8") as f:
    venues = json.load(f)
venues_by_id = {v["id"]: v for v in venues}
count = 0
with open("/tmp/tat_validated_wellness.jsonl", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        venue = venues_by_id.get(rec["venue_id"])
        if venue:
            venue["tat"] = rec["tat"]
            # If the TAT record certifies SHA and our entry didn't already
            # claim a tier, mark it as SHA Plus (TAT only certifies one level).
            if rec["tat"].get("sha_certified") and not venue.get("sha_certified"):
                venue["sha_certified"] = True
                if not venue.get("sha_tier"):
                    venue["sha_tier"] = "SHA Plus"
            count += 1
with open("data/wellness_local.json", "w", encoding="utf-8") as f:
    json.dump(venues, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Merged {count} TAT enrichments into wellness_local.json")
