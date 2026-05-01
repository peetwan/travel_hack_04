#!/usr/bin/env node
// Validate the bash-script enrichments by hitting /places/{id} (direct ID
// lookup works fine from Node) and dropping any TAT match that is more than
// ~50km from our recorded lat/lng. The bash script's keyword search returned
// some wrong-island/wrong-province matches that we need to filter out.

import { readFile, writeFile } from "node:fs/promises";

const apiKey = process.env.TAT_API_KEY;
if (!apiKey) {
  console.error("TAT_API_KEY missing");
  process.exit(1);
}

const enrichments = JSON.parse(await readFile("/tmp/tat_enrich.json", "utf8"));
const gems = JSON.parse(await readFile("data/hidden_gems.json", "utf8"));
const gemsById = new Map(gems.map((g) => [g.id, g]));

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

let kept = 0;
let dropped = 0;

for (const e of enrichments) {
  const gem = gemsById.get(e.gem_id);
  if (!gem) continue;

  // Direct ID lookup — this endpoint works reliably from Node.
  const res = await fetch(
    `https://tatdataapi.io/api/v2/places/${e.tat.place_id}`,
    { headers: { "x-api-key": apiKey } }
  );
  if (!res.ok) {
    console.log(`✗ ${e.gem_id} — details lookup failed`);
    dropped++;
    continue;
  }
  const detail = await res.json();
  const lat = parseFloat(detail.latitude);
  const lng = parseFloat(detail.longitude);
  const km = haversineKm(gem.lat, gem.lng, lat, lng);

  // Anything past 50km is almost certainly the wrong place.
  if (!Number.isFinite(km) || km > 50) {
    console.log(
      `✗ ${e.gem_id} — TAT ${detail.name} is ${km.toFixed(0)}km away (drop)`
    );
    dropped++;
    continue;
  }

  // Use the higher-quality detail thumbnail if present, else the search-result one.
  const thumb =
    detail.thumbnailUrl ??
    detail.desktopImageUrls?.[0] ??
    detail.sha?.detailThumbnail ??
    e.tat.thumbnail_url ??
    null;

  gem.tat = {
    place_id: detail.placeId,
    slug: detail.slug,
    name_th: detail.name,
    thumbnail_url: thumb,
    sha_certified: !!detail.sha,
    province_th: detail.location?.province?.name ?? "",
    detail_url: detail.fullPathUrl ?? null,
    distance_km: Math.round(km * 10) / 10,
  };
  console.log(
    `✓ ${e.gem_id} → ${detail.name} (${km.toFixed(1)}km, sha=${!!detail.sha})`
  );
  kept++;

  await new Promise((r) => setTimeout(r, 100));
}

await writeFile(
  "data/hidden_gems.json",
  JSON.stringify(gems, null, 2) + "\n"
);
console.log(`\nMerged: ${kept} kept, ${dropped} dropped.`);
