#!/usr/bin/env python3
"""Merge validated TAT enrichments into data/hidden_gems.json."""
import json

with open("data/hidden_gems.json", encoding="utf-8") as f:
    gems = json.load(f)
gems_by_id = {g["id"]: g for g in gems}
count = 0
with open("/tmp/tat_validated.jsonl", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        gem = gems_by_id.get(rec["gem_id"])
        if gem:
            gem["tat"] = rec["tat"]
            count += 1
with open("data/hidden_gems.json", "w", encoding="utf-8") as f:
    json.dump(gems, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Merged {count} TAT enrichments into hidden_gems.json")
