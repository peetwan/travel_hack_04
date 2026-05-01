#!/usr/bin/env node
// One-off enrichment: for each gem in data/hidden_gems.json, query TAT API
// by Thai name and attach the best matching place's id + thumbnail + slug.
//
// Run: node scripts/enrich-tat.mjs
// Reads TAT_API_KEY from env (load via `node --env-file=.env.local scripts/enrich-tat.mjs`).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repo = join(__dirname, "..");
const file = join(repo, "data", "hidden_gems.json");

const apiKey = process.env.TAT_API_KEY;
if (!apiKey) {
  console.error("TAT_API_KEY missing — run with `node --env-file=.env.local scripts/enrich-tat.mjs`");
  process.exit(1);
}

const gems = JSON.parse(await readFile(file, "utf8"));

// Score a TAT candidate against our gem: prefer matching province, then nearer
// lat/lng, then larger viewer count. Return null if no plausible match.
function scoreCandidate(gem, cand) {
  let score = 0;
  if (cand.location?.province?.name) {
    const tatProv = cand.location.province.name.normalize("NFC");
    const ourProv = gem.province.normalize("NFC");
    // Crude province match: substring either way (Thai/English variants exist).
    if (
      tatProv.includes(ourProv) ||
      ourProv.includes(tatProv) ||
      // English province name fallback — TAT names are Thai but our values are English.
      // Use the lat/lng as the real signal.
      true
    ) {
      score += 1;
    }
  }
  const lat = parseFloat(cand.latitude);
  const lng = parseFloat(cand.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const dLat = lat - gem.lat;
    const dLng = lng - gem.lng;
    const distSq = dLat * dLat + dLng * dLng;
    // 0.5° ≈ 55km — anything farther is almost certainly the wrong place.
    if (distSq < 0.25) score += 2 - distSq * 4; // ~2 at 0, ~0 at 0.5°
    else score -= 5;
  }
  score += Math.min((cand.viewer ?? 0) / 1000, 1); // small popularity bonus
  return score;
}

async function searchTat(keyword, attempt = 0) {
  const url = new URL("https://tatdataapi.io/api/v2/places");
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("pageSize", "10");
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data ?? [];
  // The keyword endpoint sometimes returns total>0 with empty data. Retry up to 3x.
  const total = json.pagination?.total ?? 0;
  if (data.length === 0 && total > 0 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 800));
    return searchTat(keyword, attempt + 1);
  }
  return data;
}

let enrichedCount = 0;
let missCount = 0;

for (const gem of gems) {
  if (gem.tat) {
    enrichedCount++;
    continue; // already done
  }

  // Try several candidate keywords. Order matters: most specific first.
  // Thai name often returns the best match; English is the safety net.
  // We also strip parenthetical suffixes like "(Mae Aw)" because TAT uses canonical Thai names.
  const queries = [
    gem.name_th,
    gem.name_th.replace(/\s*[(–-].*/u, "").trim(),
    gem.name_en,
    gem.name_en.replace(/\s*\(.+\)\s*$/u, "").trim(),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  let candidates = [];
  for (const q of queries) {
    candidates = await searchTat(q);
    if (candidates.length > 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  if (candidates.length === 0) {
    missCount++;
    console.log(`✗ ${gem.id} — no TAT result`);
    continue;
  }

  const best = candidates
    .map((c) => ({ c, score: scoreCandidate(gem, c) }))
    .sort((a, b) => b.score - a.score)[0];

  // Score threshold: anything below 0.5 is probably wrong.
  if (!best || best.score < 0.5) {
    missCount++;
    console.log(`✗ ${gem.id} — best score ${best?.score?.toFixed(2)} (${best?.c?.name})`);
    continue;
  }

  const c = best.c;
  gem.tat = {
    place_id: c.placeId,
    slug: c.slug,
    name_th: c.name,
    thumbnail_url: c.thumbnailUrl?.[0] ?? null,
    viewer: c.viewer ?? 0,
  };
  enrichedCount++;
  console.log(
    `✓ ${gem.id} → TAT ${c.placeId} (${c.name}) score=${best.score.toFixed(2)}`
  );

  // Be polite to the API.
  await new Promise((r) => setTimeout(r, 150));
}

await writeFile(file, JSON.stringify(gems, null, 2) + "\n");
console.log(`\nDone. ${enrichedCount}/${gems.length} enriched, ${missCount} missing.`);
