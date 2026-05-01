# Wellness data sources & maintenance

The "Thai Wellness Picks" sidebar on `/discover` is fed by `data/wellness_local.json`. Keeping it accurate and complete is a layered, cross-validated process — no single source is enough.

## Layered cross-validation

Every entry in `data/wellness_local.json` should clear **at least two** of these layers before being added or kept. The Wellness Pulse agent + the orchestrator's request-time validation enforce this for the runtime path; the rules below govern manual curation.

| Layer | What it certifies | How to check |
| --- | --- | --- |
| 1. Editorial base | Curation quality + Thai character | Human review against the criteria in this file |
| 2. Government verify | Safety + standards (Thai gov) | TAT API `tatdataapi.io` SHA Plus / Extra Plus, or `scripts/fetch-sha-wellness.sh` |
| 3. Editorial freshness | Award status, current standing | Forbes Travel Guide / Condé Nast / Travel + Leisure / World Spa Awards |
| 4. Consumer reality | Currently operating + reviewed | Google Places — rating ≥4.3, reviews ≥100, business_status `OPERATIONAL` |

## Tier 1 — Authoritative sources (must cross-check)

| Source | What to check | Cadence |
| --- | --- | --- |
| TAT API (`tatdataapi.io`) | Keyword-search "spa", "wellness", "onsen", "นวดแผนไทย", "อบสมุนไพร", "โยคะ" + filter SHA Plus / Extra Plus. Helper: `scripts/fetch-sha-wellness.sh` | Quarterly |
| Forbes Travel Guide — Five-Star + Four-Star Spa | Annual award list | Feb |
| Condé Nast Traveler — Readers' Choice Top Spas in Asia | Annual list | Oct |
| Travel + Leisure — World's Best Awards: Top Spas | Annual list | Jul |
| World Spa Awards — Thailand's Best Wellness Retreat / Resort Spa / Day Spa | Annual list | Nov |
| Michelin Keys (hotels with notable spas) | Launched 2024, expanding to Thailand | Annual |

## Tier 2 — Editorial / curation (for niche local picks)

- **Tatler Asia** — Spa Guide Thailand (often catches Thai-owned boutique venues that Forbes misses)
- **Mr & Mrs Smith** — boutique hotel/spa platform
- **Robb Report**, **Departures** — luxury angle
- **Lonely Planet "Best of Thailand"** — local picks foreigners actually use

## Tier 3 — Local-Thai authority (Thai-language)

- **DBD wellness directory** (กรมพัฒนาธุรกิจการค้า)
- **Wellness Tourism Association of Thailand**
- **TAT "Amazing Thailand Health & Wellness"** campaign assets

## Tier 4 — Live consumer signal

Validated automatically by the orchestrator at request time via `validateWellnessVenue` in [`lib/google-maps.ts`](../lib/google-maps.ts):

- Google Places rating ≥ **4.3**
- Review count ≥ **100**
- `business_status` = `OPERATIONAL`
- Match within **15 km** of curated lat/lng (avoids same-name disambiguation)

If `GOOGLE_MAPS_API_KEY` is missing, validation is skipped and the curated entry is shown as-is — no false drops.

## Editorial criteria for `data/wellness_local.json`

A candidate enters the curated dataset only if all hard rules pass:

**Hard rules**
- Has a **Thai-character signature** that's distinct from a generic foreign-branded spa (Lanna techniques, Royal Thai medicine, herbal compress, traditional saksit ritual, Thai-owned heritage brand, monastery-led meditation, natural Thai hot spring).
- **Two or more** of: Tier 1 award listing, SHA Plus / Extra Plus, Tier 2 editorial mention.
- Operating in Thailand at the lat/lng given (verified via Google Places match within 15 km).

**Soft rules (push toward YES)**
- Thai-owned operator
- ≥1 SHA Plus / Extra Plus
- Multilingual front-of-house (`languages` covers en + at least one of zh/ja/ru)

**Reject signals**
- Mass-market chain (Let's Relax, Health Land, So Thai Spa, Asia Herb Association)
- Closed permanently or undergoing rebrand

## Maintenance cadence

| Frequency | Action |
| --- | --- |
| Monthly | Run Google Places validation across the dataset; drop entries where rating drops below 4.3 or status flips to `CLOSED_PERMANENTLY` |
| Quarterly | Run `scripts/fetch-sha-wellness.sh` for new SHA Plus venues; check Forbes / Condé Nast / Travel + Leisure for new picks; refresh `awards[]` arrays |
| Per Forbes annual release (Feb) | Add any newly-rated Thailand 5-star or 4-star spa |

## Adding a new entry

1. Verify the venue against the editorial criteria above (≥2 layers, Thai-character signature).
2. Append to [`data/wellness_local.json`](../data/wellness_local.json) — required: `id`, `name_th`, `name_en`, `province`, `region`, `lat`, `lng`, `wellness_type`, `signature_treatments`, `price_tier`, `thai_authenticity` (1–5), `crowd_level` (1–5), `sha_certified`, `awards`, `languages`, `local_character`, `en_description`, `th_description`, `source_urls`.
3. Run `bash scripts/enrich-tat.sh && bash scripts/merge-tat.sh` to attach a TAT block + image (lat/lng-validated automatically). Reuses the same enrichment pipeline as `data/hidden_gems.json`.
4. The Wellness Pulse system prompt does not need changes — it reads the dataset live each request.

## Why this matters

The user-facing claim on the panel — "Cross-checked across four sources" — is enforced by this process. If the dataset drifts (closed venues, stale awards, fabricated entries), the claim becomes a lie. Run the monthly Google Places sweep, even if nothing else gets done that month.
