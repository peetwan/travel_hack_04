#!/usr/bin/env python3
"""Validate one TAT enrichment by lat/lng distance to our gem."""
# coding: utf-8
import json
import math
import sys

GEM_ID = sys.argv[1]
DETAIL_JSON = sys.stdin.read()

with open("data/hidden_gems.json", encoding="utf-8") as f:
    gems = json.load(f)
gem = next((g for g in gems if g["id"] == GEM_ID), None)

try:
    detail = json.loads(DETAIL_JSON)
except Exception:
    print("FAIL:invalid_json")
    sys.exit(0)

if not gem or not detail or detail.get("statusCode"):
    print("FAIL:lookup_error")
    sys.exit(0)

try:
    lat = float(detail.get("latitude"))
    lng = float(detail.get("longitude"))
except (TypeError, ValueError):
    print("FAIL:no_coords")
    sys.exit(0)

R = 6371
d_lat = math.radians(lat - gem["lat"])
d_lng = math.radians(lng - gem["lng"])
a = (
    math.sin(d_lat / 2) ** 2
    + math.cos(math.radians(gem["lat"]))
    * math.cos(math.radians(lat))
    * math.sin(d_lng / 2) ** 2
)
km = 2 * R * math.asin(math.sqrt(a))

if km > 50:
    print(f"FAIL:too_far_{km:.0f}km")
    sys.exit(0)

thumb = (
    detail.get("thumbnailUrl")
    or (detail.get("desktopImageUrls") or [None])[0]
    or (detail.get("sha") or {}).get("detailThumbnail")
)
tat = {
    "place_id": detail["placeId"],
    "slug": detail.get("slug", ""),
    "name_th": detail["name"],
    "thumbnail_url": thumb,
    "sha_certified": bool(detail.get("sha")),
    "province_th": (detail.get("location", {}).get("province") or {}).get("name", ""),
    "detail_url": detail.get("fullPathUrl"),
    "distance_km": round(km, 1),
}
print("OK:" + json.dumps(tat, ensure_ascii=False))
