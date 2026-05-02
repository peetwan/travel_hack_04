# Hidden Siam — Technical Overview

A single-file walkthrough of how the app actually works: what runs where, which model handles which step, what each agent's prompt asks for, and how data flows from the user's first keystroke to the streamed itinerary.

For the visual UX flow see [`design-flow.md`](design-flow.md). For the wellness data validation rules see [`wellness-data-sources.md`](wellness-data-sources.md). This document focuses on the **system** — agents, prompts, and pipelines.

---

## Table of contents

- [TL;DR](#tldr)
- [How a request flows](#how-a-request-flows)
- [Tech stack and why we picked it](#tech-stack-and-why-we-picked-it)
- [Data sources](#data-sources)
- [The agents](#the-agents)
  - [1. Destination Scout (pre-flow)](#1-destination-scout-pre-flow)
  - [2. Local Listener](#2-local-listener)
  - [3. Web Pulse](#3-web-pulse)
  - [4. Wellness Pulse](#4-wellness-pulse)
  - [5. Maps Crowd Radar (deterministic)](#5-maps-crowd-radar-deterministic)
  - [6. Crowd Analyst](#6-crowd-analyst)
  - [7. Cultural Curator](#7-cultural-curator)
  - [8. Route Planner](#8-route-planner)
  - [9. Weather Watcher](#9-weather-watcher)
  - [10. Verifier](#10-verifier)
- [Orchestration in detail](#orchestration-in-detail)
- [SSE event taxonomy](#sse-event-taxonomy)
- [Cross-validation pipelines](#cross-validation-pipelines)
- [Deterministic post-processing](#deterministic-post-processing)
- [Performance choices](#performance-choices)
- [What didn't work (the burned-by-this list)](#what-didnt-work-the-burned-by-this-list)

---

## TL;DR

Hidden Siam is a Next.js 16 App Router app that orchestrates **eight specialised AI agents** plus a **Destination Scout pre-flow** to produce a less-touristy Thai itinerary. The user describes their travel style; the Scout proposes 3–5 trip clusters; the user picks one; and the live agent crew then runs over a curated dataset (91 gems, 89 wellness venues, 30 traps), live Thai-web search (Tavily + Exa + Firecrawl), Google Places, Open-Meteo, and a hand-coded crowd-pressure scorer. Every agent uses **Gemini 3.1 Flash Lite** with `thinkingLevel: "minimal"` and structured output via Zod schemas. The whole run streams as Server-Sent Events to `/discover`, where the user watches each agent narrate its step.

End-to-end target latency: **~25 seconds** with all live providers wired up.

---

## How a request flows

```
User on /                           ← types travel-style prompt + start date
       │
       ▼
POST /api/destination-suggestions   ← Destination Scout (Gemini 3.1 Flash Lite)
       │  returns 3–5 trip clusters with composed_prompt
       ▼
User on /destinations               ← picks one card
       │
       ▼
POST /api/orchestrate (SSE)         ← live agent crew
       │
       ├─ Listener         ← curated candidate set (8–12 gems)
       │
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │      [parallel branches]
       ▼              ▼              ▼              ▼
   Web Pulse    Maps Crowd      Wellness Pulse   (Wellness Pulse
   (Tavily +    Radar (Google   (curated +        also kicks off a
    Exa +       Places, no      80 km filter +    luxuryWellnessSearch
    Firecrawl)  Gemini)         Google validate)  in parallel for
       │              │              │             diagnostics only)
       └──────────────┴──────────────┘
                      │
                      ▼
              Crowd Analyst   ← filters + flags traps
                      │
                      ▼
                  Curator     ← scores 0–1 with web evidence weighting
                      │
                      ▼
                  Planner     ← 1–2 bases, days[], dinners
                      │
              ┌───────┴────────┐
              ▼                ▼
       Weather Watcher   Verifier               [parallel]
       (Open-Meteo +     (seasonal closures,
        Gemini)           holidays, etiquette)
              └───────┬────────┘
                      │
                      ▼
            FinalItinerary streamed via SSE →
            /discover renders the result
```

Every box on the right side of `/discover` corresponds to a row in `AgentCrewPanel`. The user sees agents tick from idle → thinking → done with their narration sentence streamed live.

---

## Tech stack and why we picked it

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 App Router** (Turbopack) | App Router gives us per-route runtime config (we set `runtime: "nodejs"`, `maxDuration: 120` on the SSE endpoint). Turbopack keeps dev startup under 2s. |
| Language | TypeScript 5 | All agent IO is Zod-validated; sharing types between server and client (`AgentEvent`, `FinalItinerary`) keeps the SSE client typed end-to-end. |
| LLM | **Gemini 3.1 Flash Lite Preview** via `@ai-sdk/google` | Tuned the hard way — Pro 3.1 timed out at 60s+, Flash 3 was slow on the planner schema, Flash Lite 3.1 + `thinkingLevel: "minimal"` lands every prompt under 5s. Free tier (1500 req/day) is plenty for a hackathon demo. |
| LLM SDK | **Vercel AI SDK 6** (`generateObject` with Zod) | Zod schemas double as runtime validation + TypeScript types. `generateObject` handles JSON-mode + retries; we get structured output without prompt-engineering JSON formatting. |
| Web search | **Tavily** + **Exa** | Two providers run in parallel for redundancy and result diversity. Tavily indexes Thai travel sources well; Exa does neural retrieval. Domain-allowlisted to Pantip / chillpainai / TAT / etc. |
| Page scraping | **Firecrawl** | Top 3 search hits get scraped for full markdown; gives Web Pulse "page-scrape" evidence vs. mere snippets. 8s timeout caps tail latency. |
| Geo / crowd | **Google Places (New)** | Single source for crowd-pressure proxy (review count + business status), discovered-gem geocoding, and wellness venue cross-validation. The Places (New) API has the field-mask we need for cheap calls. |
| Weather | **Open-Meteo** | Free, no API key, 16-day horizon. We use forecast_days + WMO weather codes; mapped to "sunny"/"rainy"/"thunderstorm" labels for the Weather Watcher prompt. |
| Map | **react-leaflet** + **CARTO Light tiles** | OSM-based; no Maps key for the map itself (separate from Places API). Light theme matches the "Jasmine Modern" design. |
| Animations | **Framer Motion** | The agent panel is the demo; animations sell the multi-agent feel. |
| Styling | **Tailwind CSS 4** (`@theme inline`) | No `tailwind.config.js` — design tokens live in `app/globals.css`. CSS variables (`var(--saffron)`, `var(--jade)`) drive the Thai-luxury palette. |
| Hosting | **Railway** | `railway.json` + `nixpacks.toml`; one-click deploy that auto-detects Next.js and injects `PORT`. Live demo: https://travelhack04-copy-3-production.up.railway.app |
| Persistence | **None** — three JSON files | 91 gems + 89 wellness + 30 traps fit in 250 KB. No DB means no migrations, no connection pool, no cold-start cost on Railway. |

### Why eight agents instead of one Gemini call

A single Gemini call could in principle produce a full itinerary in one shot. We deliberately did not do that, for three reasons:

1. **The visible work is the demo.** Judges in an AI hackathon want to see agentic patterns. Streaming "Listener thinking → Web Pulse hitting Tavily → Crowd Analyst dropping 2 candidates" is the product, not boilerplate.
2. **Structured outputs at boundaries make debugging tractable.** When the planner produces a wrong itinerary, we can read the Listener's narration, the Web Pulse validations, and the Curator's scores to find which step went off.
3. **Different agents need different context shapes.** Listener sees the full curated dataset; Curator sees only filtered candidates + web evidence; Planner sees scored picks; Verifier sees the full gem objects of the final selection. Splitting these saves tokens and keeps each prompt focused.

---

## Data sources

### Curated datasets (JSON files, no DB)

| File | Entries | What's in it | Read by |
|---|---:|---|---|
| [`data/hidden_gems.json`](../data/hidden_gems.json) | **91** | Gems across all 77 provinces. Required fields: `id`, `name_th`, `name_en`, `province`, `region`, `lat`, `lng`, `category`, `vibe_tags`, `crowd_level` (1–5), `auth_score` (1–5), `best_time`, `thai_description`, `en_description`, `source_urls`, `near_traps`. Optional `tat: { place_id, slug, thumbnail_url, sha_certified, province_th, detail_url, distance_km }` (lat/lng-validated within 50 km). | Listener, Destination Scout, Planner, Verifier; loaded into `GEMS_BY_ID` map at orchestrator startup |
| [`data/wellness_local.json`](../data/wellness_local.json) | **89** | Curated Thai wellness venues. Required fields: `id`, `name_th`, `name_en`, `province`, `region`, `lat`, `lng`, `wellness_type`, `signature_treatments`, `price_tier`, `thai_authenticity` (1–5), `crowd_level`, `sha_certified`, `awards`, `languages`, `local_character`, `en_description`, `th_description`, `source_urls`. Optional: `sha_tier`, `booking_url`, TAT enrichment. | Wellness Pulse only; loaded into `WELLNESS_BY_ID` map |
| [`data/tourist_traps.json`](../data/tourist_traps.json) | **30** | Known traps + their better alternatives. Fields: `id`, `name_en`, `name_th`, `province`, `why_avoid`, `better_alternatives`. | Crowd Analyst only; loaded into `TRAPS_BY_ID` map |

> [!NOTE]
> Data is enriched offline — `scripts/enrich-tat.sh` + `scripts/merge-tat.sh` for gems, `scripts/enrich-tat-wellness.sh` + `scripts/merge-tat-wellness.sh` for wellness. Both pipelines use **bash + curl + python**, not Node fetch — TAT's Cloudflare BKK edge returns empty data via Node, while curl resolves to a healthy SIN edge. See AGENTS.md "Don't break" #1.

### Live HTTP APIs

| Provider | File | Env var | Purpose | Where it's called |
|---|---|---|---|---|
| **Tavily** | [`lib/web-search.ts:57–97`](../lib/web-search.ts) | `TAVILY_API_KEY` | Thai travel domain search; runs in parallel with Exa | `realtimeThaiSearch` (Web Pulse), `luxuryWellnessSearch` (Wellness Pulse diagnostics) |
| **Exa** | [`lib/web-search.ts:99–141`](../lib/web-search.ts) | `EXA_API_KEY` | Neural Thai travel domain search | Same as Tavily |
| **Firecrawl** | [`lib/web-search.ts:143–174`](../lib/web-search.ts) | `FIRECRAWL_API_KEY` | Page-level scrape of top 3 hits → markdown evidence | `enrichWithFirecrawl` (Web Pulse) |
| **Google Places (New)** | [`lib/google-maps.ts`](../lib/google-maps.ts) | `GOOGLE_MAPS_API_KEY` | Crowd radar, photo URIs, geocode discovered gems, validate wellness venues | `fetchMapsCrowdSignals`, `geocodeDiscoveredPlace`, `validateWellnessVenue`, `resolveGooglePhotoUri` |
| **Open-Meteo** | [`lib/weather.ts`](../lib/weather.ts) | none (free) | 16-day daily forecast per stay base | `fetchForecastsForBases` (Weather Watcher) |
| **TAT Open Data** | `scripts/*.sh` (offline) | `TAT_API_KEY` | Place enrichment (thumbnail + SHA cert) — **never called at request time** | Enrichment scripts only |

Domain allowlists:

- **Thai travel**, used by Web Pulse: `pantip.com`, `chillpainai.com`, `readme.me`, `paiduaykan.com`, `mushroomtravel.com`, `tourismthailand.org`, `dasta.or.th`, `museumthailand.com`, `travel.trueid.net`, `roigoo.com` ([`web-search.ts:6–17`](../lib/web-search.ts))
- **Luxury travel**, used by Wellness Pulse diagnostics: `cntraveler.com`, `travelandleisure.com`, `robbreport.com`, `tatlerasia.com`, `forbestravelguide.com`, `departures.com`, `lonelyplanet.com`, `afar.com`, `mrandmrssmith.com`, `worldspaawards.com`, `michelin.com` ([`web-search.ts:19–32`](../lib/web-search.ts))

> [!IMPORTANT]
> Without a key, each provider degrades gracefully. The agent emits a "skipped" diagnostic and the rest of the pipeline still runs. The only hard requirement is `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini.

---

## The agents

Each section below: purpose, runner location, IO contract, model, the **actual prompt** verbatim, and where the output surfaces.

### 1. Destination Scout (pre-flow)

**Purpose.** Convert a style-only intent ("peaceful beaches and seafood") into 3–5 concrete trip clusters the user can pick from before the live agent crew runs.

**Not part of `AGENT_ORDER`** — the Scout runs once via a separate `POST /api/destination-suggestions` JSON endpoint, not inside the SSE stream.

| Field | Value |
|---|---|
| Runner | `runDestinationScout` in [`lib/agents/runners.ts`](../lib/agents/runners.ts) |
| Input | `{ stylePrompt, startDate?, dataset: HiddenGem[] }` |
| Output schema | `destinationSuggestionOutputSchema` in [`lib/agents/schemas.ts:22`](../lib/agents/schemas.ts) → 1–5 suggestions, each with `id`, `title`, `subtitle`, `provinces`, `region`, `anchor_gem_ids`, `style_tags`, `why`, `avoidance_note`, `composed_prompt` |
| Model | Gemini 3.1 Flash Lite, `thinkingLevel: "minimal"` |
| Surfaces in | `/destinations` page as customer-facing cards |
| Fallback | `buildFallbackDestinationSuggestions` deterministically tops up if the model returns <3 valid clusters or invalid `anchor_gem_ids` |

**Prompt** ([`prompts.ts:1–15`](../lib/agents/prompts.ts)):

> Suggest trip clusters, not single famous places and not province-only labels. A cluster can cover 1–3 nearby provinces and should have 2–4 anchor gems from the dataset.
>
> Use only `anchor_gem_ids` that exist in the provided dataset. Never invent ids.
>
> Bias toward low `crowd_level`, high `auth_score`, and a coherent route.
>
> Keep the anti-overtourism mandate visible: avoid clusters that would send the user into Phi Phi, Patong, Khao San Road, Damnoen Saduak unless the cluster is explicitly an alternative.
>
> `composed_prompt` should preserve the user's style words and add a clear destination hint: provinces + anchor gem names + "build a slow, less-crowded itinerary around this cluster."

---

### 2. Local Listener

**Purpose.** First live agent. Reads the user's composed prompt and surfaces 8–12 candidate gem ids from the curated dataset. Cast a wide net — downstream agents will filter.

| Field | Value |
|---|---|
| Runner | `runListener` in `lib/agents/runners.ts` |
| Input | `{ userPrompt, dataset: HiddenGem[] }` |
| Output schema | `listenerOutputSchema` → `{ narration, candidate_ids, reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Consumed by | Web Pulse, Maps Crowd Radar, Wellness Pulse, Crowd Analyst (the entire downstream is scoped to this candidate set) |

**Distinctive rule** ([`prompts.ts:17–27`](../lib/agents/prompts.ts)):

> Reject the impulse to recommend famous spots — that is exactly what we are building against.

The prompt explicitly tells the model to "cast a slightly wide net" because aggressive filtering happens later. If the user names a province, prioritise that area but still include 2–3 wildcard alternatives.

---

### 3. Web Pulse

**Purpose.** The only agent that reads the live web. Two outputs: `validations[]` (verdicts on candidate gems) and `discovered_gems[]` (places NOT in the dataset that were named in fresh Thai-source hits).

| Field | Value |
|---|---|
| Runner | `runWebPulse` in `lib/agents/runners.ts` |
| Input | `userPrompt`, Listener's candidate set (slim view), search hits from `realtimeThaiSearch` |
| Output schema | `webPulseOutputSchema` → `{ narration, validations[], discovered_gems[] (max 5), reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Consumed by | Curator (validations), orchestrator (discoveries → geocode → final itinerary) |

**Live-search pipeline** ([`web-search.ts:365–408`](../lib/web-search.ts)):

1. Tavily and Exa run in parallel, both scoped to `THAI_TRAVEL_DOMAINS`.
2. Hits deduped by URL.
3. Top 3 unique URLs sent to Firecrawl for full-page markdown scrape (8s wall-clock cap).
4. Each hit tagged `evidence_level: "page-scrape"` (Firecrawl-enriched) or `"search-snippet"` (Tavily/Exa raw).

**Distinctive rules** ([`prompts.ts:102–114`](../lib/agents/prompts.ts)):

> Validations are for the candidate set only — `gem_id` MUST match a candidate id. If a hit describes a real Thai place that is NOT in the candidate set but clearly fits the user's prompt and feels authentic / off-the-beaten-path, surface it as a `discovered_gems` entry instead. Max 5 discoveries.

> Be precise about freshness. If a hit has `published_at` from the current/previous year, you may call it recent. If it is undated, call it "live-search visibility" or "currently indexed", not "recent" or "fresh". When diagnostics say 0 dated hits, explicitly say the evidence is undated.

The orchestrator then geocodes each `discovered_gem` via Google Places ([`orchestrator.ts:275–317`](../lib/agents/orchestrator.ts)). Anything that fails to resolve to coordinates is dropped silently — the user only sees discoveries with confirmed coords + a Maps link. **Discoveries never enter Curator/Planner**; they appear in a "Bonus places we spotted online" sidebar labelled clearly as leads.

---

### 4. Wellness Pulse

**Purpose.** Pick 0–5 Thai wellness venues from the curated dataset that match the trip's geography and style. Empty array is a valid response when the trip has no wellness intent.

| Field | Value |
|---|---|
| Runner | `runWellnessPulse` in `lib/agents/runners.ts` |
| Input | `userPrompt`, geographically pre-filtered wellness dataset (≤80 km from a Listener candidate), `tripProvinces`, candidate gem coordinates |
| Output schema | `wellnessPulseOutputSchema` → `{ narration, picks[] (id + why + luxury_signals[]), reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Surfaces in | "Thai Wellness Picks" sidebar on `/discover` |

**Pre-filter** (deterministic, before the model runs): haversine distance to nearest Listener candidate; venues >80 km dropped. Each entry passed to the model gets `km_from_trip` + `nearest_trip_province` so the model can prefer same-province picks.

**Hard rules** ([`prompts.ts:116–137`](../lib/agents/prompts.ts)):

> Pick **0–5** venues from the curated dataset whose ids exist in the input. Quality bar: prefer Thai-owned / Thai-heritage brands, Lanna or Royal Thai signature treatments, SHA Plus / SHA Extra Plus certification, and award-listed venues (Forbes Travel Guide, Condé Nast, Travel + Leisure, World Spa Awards). Anti-overtourism still applies — never propose a chain like Let's Relax, Health Land, or So Thai Spa, even if the user asks for a generic massage.

> Geographic relevance is a HARD rule. All picks must have `km_from_trip` ≤ 80.

> If the user's prompt has no wellness intent at all (pure adventure / food crawl / no rest stops), pick **0**. An empty picks array is a valid response — better than forcing irrelevant venues.

**After the model returns**, the orchestrator validates each pick via `validateWellnessVenue` ([`google-maps.ts`](../lib/google-maps.ts)) — **rating ≥ 4.3, review count ≥ 100, business status = OPERATIONAL**. Failures are dropped. In parallel, `luxuryWellnessSearch` hits the luxury domains for editorial freshness diagnostics — those hits are surfaced in agent-panel chips only, never fed back into the model.

This four-layer cross-validation (curated → SHA → Google Places → optional editorial) is documented in detail in [`docs/wellness-data-sources.md`](wellness-data-sources.md).

---

### 5. Maps Crowd Radar (deterministic)

**Purpose.** Calibrated proxy for "how mainstream is this place right now?" using Google Places review counts + business status. **Not Gemini-based.**

| Field | Value |
|---|---|
| Function | `fetchMapsCrowdSignals` in [`lib/google-maps.ts`](../lib/google-maps.ts) |
| Input | `gems: HiddenGem[]`, `timeoutMs: 7000` |
| Output | `MapsCrowdReport` → array of `MapsCrowdSignal` (one per gem: `gem_id`, `pressure`, `pressure_score`, `confidence`, `reasons[]`, `matched_place`) |
| API | `POST https://places.googleapis.com/v1/places:searchText` |
| Field mask | `places.id, displayName, location, businessStatus, rating, userRatingCount, currentOpeningHours, primaryType, types, googleMapsUri, photos` |
| Runs in parallel with | Web Pulse, Wellness Pulse |

**Pressure scoring** is calibrated per-category because a "famous" beach has 10× more reviews than a "famous" village. Thresholds in [`google-maps.ts`](../lib/google-maps.ts):

| Category | low / medium / high review-count thresholds |
|---|---|
| village | 250 / 1500 / 5000 |
| nature | 500 / 2500 / 8000 |
| beach | 500 / 3000 / 10000 |
| temple, food, culture, adventure | similar tiered scales |

Results pass through `enrichCrowdReport` in [`lib/crowd-radar.ts`](../lib/crowd-radar.ts), which combines the Maps signal with **trip calendar pressure** (weekend/holiday overlaps from `lib/thai-holidays.ts`) and **Web Pulse tourism-pressure terms**. The final `pressure_score` is what the Crowd Analyst agent sees.

> [!CAUTION]
> Google Places does NOT expose live "busy now" counts. The wording in agent prompts and UI tooltips says "popularity proxy based on review volume" — never "currently crowded". This is enforced in CROWD_ANALYST_PROMPT and AGENTS.md "Don't break" #5.

---

### 6. Crowd Analyst

**Purpose.** Filter the candidate set by crowd tolerance, surface tourist-trap warnings.

| Field | Value |
|---|---|
| Runner | `runCrowdAnalyst` in `lib/agents/runners.ts` |
| Input | `userPrompt`, Listener candidates, Maps Crowd Radar signals (enriched), all 30 traps |
| Output schema | `crowdAnalystOutputSchema` → `{ narration, filtered_ids, warned_traps, candidate_assessments, reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Consumed by | Curator (filtered_ids), final itinerary (warned_traps display) |

**The "always keep ≥5" rule** ([`prompts.ts:29–47`](../lib/agents/prompts.ts)):

> Always keep at least 5 gems unless the candidate list is smaller — if your strict filter would leave <5, relax the threshold by 1 until you have at least 5. The Planner needs options.

**Tolerance defaults**:

| User signal | crowd_level cap |
|---|---|
| "hate crowds" / "peaceful" / "off the beaten path" | ≤ 3 (intentionally not 2 — keep the pool healthy) |
| "lively" / "social" | ≤ 4 |
| Unclear | ≤ 4 |

Maps signals are layered on top of the curated `crowd_level`: `pressure: high` or `user_rating_count ≥ 5000` drops a candidate for crowd-averse users; `pressure: medium` keeps with caution; missing/timeout is "unknown" and never penalised.

---

### 7. Cultural Curator

**Purpose.** Score each surviving candidate 0–1 against the user's vibe + Web Pulse evidence.

| Field | Value |
|---|---|
| Runner | `runCurator` in `lib/agents/runners.ts` |
| Input | `userPrompt`, Crowd Analyst's filtered candidates, Web Pulse validations |
| Output schema | `curatorOutputSchema` → `{ narration, scored[] (id, score, why), reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Consumed by | Planner (sorted by score desc) |

**Web evidence weighting** ([`prompts.ts:49–64`](../lib/agents/prompts.ts)):

| Verdict | Effect on score |
|---|---|
| `supports` | +0.05 |
| `contradicts` | −0.15 |
| `neutral` | no change (may quote in `why`) |
| Empty validations | score from gem fields only |

**Freshness scrubbing**: if no Web Pulse hit has a `published_at`, the Curator is told to call evidence "live-search evidence" / "indexed visibility" instead of "recent" / "fresh". A post-process pass in [`runners.ts`](../lib/agents/runners.ts) replaces lingering "recent evidence" wording with "evidence suggests" when only undated hits exist.

---

### 8. Route Planner

**Purpose.** Pick 2–4 gems from the scored list and build the day-by-day plan with 1–2 stay bases. Slow travel is the religion.

| Field | Value |
|---|---|
| Runner | `runPlanner` in `lib/agents/runners.ts` |
| Input | `userPrompt`, Curator scores (sorted desc), `gemsById` |
| Output schema | `plannerOutputSchema` → `{ narration, selected_ids, stays[], days[] (optional), reasoning }` |
| Model | Gemini 3.1 Flash Lite (this is the **latency hot-spot** because of the optional nested `days[]` schema with morning/afternoon/dinner blocks) |
| Consumed by | Weather Watcher, Verifier, photo-URI resolver, final itinerary |

**Slow-travel rules** ([`prompts.ts:66–82`](../lib/agents/prompts.ts)):

> **Prefer 1–2 bases (stays), not 3+.** A 3-day trip should usually be a single base. A weekend should be a single base. A week can have at most 2 bases. Only stretch to 3 bases for trips of 8+ nights.
>
> **Geographic concentration first.** Cluster gems by province / adjacent provinces. If two highly-scored gems are in different regions (Mae Hong Son + Trang), pick the cluster that fits the user's prompt better and drop the outlier.
>
> **Pick 2–4 gems total.** More than 4 turns into a checklist; fewer than 2 leaves nothing to choose.

**Day shape**: every day must have `morning`, `afternoon`, AND `evening_dinner`. Morning and afternoon are `{place, activity, gem_id?}` — `place` must be a concrete named location ("Pai Canyon viewpoint"), never a placeholder ("the area", "your hotel"). `evening_dinner` is `{name, why}` — the prompt explicitly says **never invent** restaurants; fall back to a real, named restaurant in the same province if the base doesn't have an obvious pick.

**Nights normalization** ([`runners.ts`](../lib/agents/runners.ts), `normalizeStayNights`): Gemini sometimes equates nights with days, or names the wrong gem_id in `days[].stay_at`. The orchestrator post-processes to enforce `total_nights = days.length - 1`, distributing across stays via `days[].stay_at` matching when totals reconcile, round-robin fallback otherwise. This is documented in AGENTS.md "Don't break" #7.

---

### 9. Weather Watcher

**Purpose.** Read a 14-day Open-Meteo forecast aligned to the user's trip dates, write per-day actionable advice.

| Field | Value |
|---|---|
| Runner | `runWeatherWatcher` in `lib/agents/runners.ts` |
| Input | `userPrompt`, `daysWithForecast[]` (one entry per planner day, with morning/afternoon/dinner activities + that day's forecast) |
| Output schema | `weatherWatcherOutputSchema` → `{ narration, per_day_advice[] (day + advice), best_day_for_outdoor (nullable), reasoning }` |
| Model | Gemini 3.1 Flash Lite |
| Surfaces in | Day timeline (advice attached to each day) + result hero (best_day_for_outdoor mention) |
| Skipped when | `tripStart > today + 16 days` — Open-Meteo has a 16-day horizon. Orchestrator emits a "beyond forecast horizon" complete event with no per-day advice. |

**Forecast fields used**: `weather_code` (mapped via WMO codes to "sunny" / "rainy" / "thunderstorm" / etc.), `temperature_2m_max/min`, `precipitation_sum`, `precipitation_probability_max`, `uv_index_max`. Timezone fixed to `Asia/Bangkok`.

**Tone instruction** ([`prompts.ts:139–152`](../lib/agents/prompts.ts)):

> Style: warm, useful, never alarmist. Don't list temperature/precipitation numbers — the UI shows those. Talk like a local guide who looked at the weather and is giving you the heads-up.

---

### 10. Verifier

**Purpose.** Final sanity check — seasonal closures, monsoon ferry suspensions, holiday crowding, etiquette tips.

| Field | Value |
|---|---|
| Runner | `runVerifier` in `lib/agents/runners.ts` |
| Input | `userPrompt`, Planner's selected gems (full objects), trip dates, overlapping Thai holidays |
| Output schema | `verifierOutputSchema` → `{ narration, warnings, tips (max 5), is_valid }` |
| Model | Gemini 3.1 Flash Lite |
| Surfaces in | "Local intel" section (warnings + tips) at the bottom of `/discover` |

**Hard-coded seasonal rules in the prompt** ([`prompts.ts:84–100`](../lib/agents/prompts.ts)):

| Place | Closure window |
|---|---|
| Phu Kradueng | Jun–Sep |
| Sam Phan Bok | dry season only Jan–May |
| Phu Soi Dao | Aug–Oct only |
| Doi Inthanon Kew Mae Pan trail | Jun–Oct |
| Islands generally | wet season May–Oct |

**Holiday awareness** ([`lib/thai-holidays.ts`](../lib/thai-holidays.ts)): hardcoded 2026/2027 calendar; `holidaysInRange(start, end)` filters overlaps. Prompt says: *"Songkran lands on day 2 — Mae Kampong's quiet trail will turn into a parade. Move there day 4 if you can."* — example of the kind of context-aware tip we want.

`is_valid: false` only if something is **fundamentally broken** (every pick closed, all days conflict with crowd-averse user during a high-impact holiday). Soft warnings flow through `warnings[]`.

---

## Orchestration in detail

The `orchestrate` function in [`lib/agents/orchestrator.ts`](../lib/agents/orchestrator.ts) is one long function that:

1. Resolves `tripStart` (user-supplied or default = today + 7 days).
2. Computes `inferredTripDays` from the prompt and `tripEnd`.
3. Pre-fetches `crowdWindowHolidays` from `holidaysInRange`.
4. Emits `agent_start` for the orchestrator itself.

Then runs **seven phases**:

### Phase 1 — Listener (sequential)

```
emit agent_start (listener)
  await runListener(...)
  build listenerCandidates (filter dataset to candidate_ids)
  KICK OFF crowdRadarTask = fetchMapsCrowdSignals(candidates) (NOT awaited)
emit agent_complete (listener)
```

### Phase 2 — Web Pulse + Wellness Pulse (parallel)

Both start emitting events simultaneously. Web Pulse is `await`ed inline because Curator depends on it; Wellness Pulse is kicked off as a promise and awaited later.

```
emit agent_start (web-pulse) + agent_progress
  await realtimeThaiSearch (Tavily ‖ Exa → dedupe → Firecrawl top 3)
  await runWebPulse(...)
  geocode discovered_gems via Google Places (6s timeout, drop unresolvable)
emit agent_complete (web-pulse)

emit agent_start (wellness-pulse) + agent_progress
  wellnessTask = runWellnessPulse(...) ‖ luxuryWellnessSearch(...)
  [held — awaited later]
```

### Phase 3 — Maps Crowd Radar resolves + Crowd Analyst (sequential)

```
await crowdRadarTask              ← from Phase 1 kickoff
enrichCrowdReport(maps, calendar, web)
emit agent_start (crowd-analyst)
  await runCrowdAnalyst(...)
emit agent_complete (crowd-analyst)
```

### Phase 4 — Curator (sequential)

```
emit agent_start (curator)
  await runCurator(filtered, web evidence)
  scrub freshness wording if all hits undated
emit agent_complete (curator)
```

### Phase 5 — Planner (sequential)

```
emit agent_start (planner)
  await runPlanner(scored sorted desc)
  normalizeStayNights(planner.stays, planner.days)
  IF GOOGLE_MAPS_API_KEY:
    await Promise.allSettled per selected gem:
      resolveGooglePhotoUri(matched_place.photo_name) (5s timeout)
      attach to crowd-radar signal as google_photo_url
emit agent_complete (planner)
```

### Phase 6 — Weather Watcher + Verifier (parallel)

Both kick off, both `await`ed via `Promise.all`.

```
emit agent_start (weather-watcher) + agent_start (verifier)

weatherTask:
  IF tripStart > today + 16 days:
    emit agent_complete (weather-watcher, skipped)
  ELSE:
    uniqueBases = distinct gems from planner.days[].stay_at
    await fetchForecastsForBases(bases)
    align forecast to trip days via tripStartOffset
    await runWeatherWatcher(daysWithForecast)
    decorate planner.days with weather + advice
    emit agent_complete (weather-watcher)

verifierTask:
  await runVerifier(selectedGems, tripDates, overlappingHolidays)
  emit agent_complete (verifier)

await Promise.all([weatherTask, verifierTask])
await wellnessTask        ← from Phase 2 kickoff
emit agent_complete (wellness-pulse)
```

### Phase 7 — Compose final itinerary

```
filter validStays (gem_id exists in dataset)
build finalDays:
  FOR each day:
    date = addDaysISO(tripStart, day - 1)
    holiday = holidayByDate.get(date)
    attach date + holiday + weather + advice

compose FinalItinerary with:
  summary, reasoning, selected_gems, avoided_traps,
  stays, days, tips, web_evidence, weather, trip_dates,
  holidays, crowd_radar, discovered_gems[], wellness_finds[],
  wellness_diagnostics

emit final_result (orchestrator, data: FinalItinerary)
emit agent_complete (orchestrator, total time message)
emit done
```

### Total wall-clock

With all live providers wired and warm prompt cache, the run lands in **~25 s**. Cold cache (first request after deploy) adds ~5 s for Gemini compilation.

---

## SSE event taxonomy

Every event emitted by the orchestrator has shape `{ type, agent?, message?, data?, timestamp }` (see [`lib/types.ts`](../lib/types.ts) → `AgentEvent`).

| Event type | Fired by | When | Carries |
|---|---|---|---|
| `agent_start` | Each phase boundary | Right before an agent's work begins | `agent`, intro `message` |
| `agent_progress` | Multi-step phases (Web Pulse, Wellness Pulse) | While work continues — diagnostic snapshots | `agent`, `message`, partial `data` (counts, candidate ids) |
| `agent_complete` | Each phase exit | Agent finished or was skipped | `agent`, narration `message`, full `data` payload |
| `agent_thinking` | Reserved | Not emitted in current code | — |
| `agent_error` | Reserved | Not emitted; errors logged via `error` event instead | — |
| `final_result` | Phase 7 | After the itinerary is composed | `agent: "orchestrator"`, `data: FinalItinerary` |
| `error` | Top-level catch | Any uncaught error in orchestrate | `message` |
| `done` | Last frame | Always emitted before the SSE stream closes | `timestamp` |

The client in [`app/discover/page.tsx`](../app/discover/page.tsx) maintains an `agents: Record<AgentName, AgentState>` map keyed by agent name, plus a `final: FinalItinerary | null` slot. Each event is dispatched into a small reducer that updates one entry. The UI re-renders the `AgentCrewPanel` rows from this state on every event.

> [!TIP]
> Want to debug a specific run? The `agent_complete` events carry the full structured output from each agent — open DevTools → Network → the `/api/orchestrate` request → "EventStream" tab to see every chunk.

---

## Cross-validation pipelines

Three layered validation pipelines run in parallel after Listener. Each blends curated data with at least one live signal.

### Web Pulse pipeline

```
Listener candidates
        ↓
Tavily (Thai domains)  ‖  Exa (Thai domains)
        ↓                    ↓
        └─── dedupe by URL ───┘
                ↓
        Firecrawl scrapes top 3 (markdown)
                ↓
        Hits with evidence_level: page-scrape | search-snippet
                ↓
        runWebPulse (Gemini)
                ↓
        validations[] (gem_id ∈ candidates)
        discovered_gems[] (NOT in dataset, max 5, must be named in a hit)
                ↓
        geocode discovered_gems via Google Places (drop unresolvable)
                ↓
        WebEvidence object → Curator + final itinerary
```

### Wellness Pulse pipeline

```
Listener trip provinces + candidate gem coordinates
        ↓
Geographic pre-filter: ≤80 km haversine to any candidate
        ↓
Slim wellness dataset → runWellnessPulse (Gemini, picks 0–5 ids)
        ↓                                   ‖
        ↓               luxuryWellnessSearch (Tavily/Exa,
        ↓               LUXURY_TRAVEL_DOMAINS) — diagnostics only,
        ↓               not fed back into the model
        ↓
For each pick:
  validateWellnessVenue (Google Places)
    rating ≥ 4.3 ∧ reviews ≥ 100 ∧ businessStatus = OPERATIONAL
    drop on failure
        ↓
Resolve google_photo_url (5s timeout)
        ↓
wellness_finds[] → "Thai Wellness Picks" sidebar
```

### Maps Crowd Radar pipeline (deterministic only)

```
Listener candidates
        ↓
fetchMapsCrowdSignals (Google Places searchText, 7s batch timeout)
        ↓
For each candidate:
  match by name + province + lat/lng
  pull rating, userRatingCount, businessStatus, openNow, photos
        ↓
Score per category (review-count thresholds)
        ↓
enrichCrowdReport: combine with trip calendar + Web Pulse pressure terms
        ↓
MapsCrowdReport → Crowd Analyst input
```

---

## Deterministic post-processing

Several steps in the orchestrator run **without** Gemini. Each fixes a known LLM failure mode.

| Step | File / function | What it fixes |
|---|---|---|
| `normalizeStayNights` | `runners.ts` | Gemini equates `nights` with `days`; this step makes `total_nights = days.length - 1` and distributes round-robin if `days[].stay_at` doesn't reconcile |
| `resolveGooglePhotoUri` | `google-maps.ts` | Google Places returns `photo.name` paths; we swap them for public CDN URLs server-side so the API key never leaks to the client |
| Holiday decoration | Inline in `orchestrator.ts` | For each day, computes the absolute date and looks up overlapping Thai holidays from `lib/thai-holidays.ts` |
| Discovery geocoding | Inline in `orchestrator.ts` | Web Pulse can name places without coordinates; Google Places resolves them, drops failures |
| Photo fallback | `components/GemCard.tsx` `<img onError>` | When TAT thumbnail 404s at runtime, swap to Google Places photo automatically |
| Freshness wording scrubber | `runners.ts` (Curator post-process) | Replaces "recent evidence" with "evidence suggests" when no hit has a `published_at` |

---

## Performance choices

### Why Flash Lite 3.1 + `thinkingLevel: "minimal"` everywhere

Tested matrix:

| Model | Planner schema latency | Verdict |
|---|---|---|
| Gemini 3.1 Pro | 60 s+ (timeout) | Out — too slow even with low thinking |
| Gemini 3 Flash Preview | 8–15 s | Out — slow on optional nested fields |
| Gemini 2.5 Flash | 3–6 s | Considered — but doesn't accept `thinkingLevel`, would need branching |
| **Gemini 3.1 Flash Lite Preview + minimal thinking** | **<5 s** | **Picked.** Every agent under 5s, full pipeline ~25s |

The planner schema (with optional `days[]` containing nested morning/afternoon/dinner blocks) is the latency hot-spot. **Re-test that schema specifically** before switching models.

### Where prompt caching helps

Vercel AI SDK 6 + `@ai-sdk/google` will reuse cache if the **system prompt** + **user message prefix** match across requests. We optimise for this:

- All system prompts are **constant strings** in [`prompts.ts`](../lib/agents/prompts.ts) — no template interpolation.
- Per-request dynamic context (candidate gems, web evidence, scored picks, trip dates, holidays) lives in the **user message**, not the system prompt.
- Verifier's user message starts with structured constants (`Trip dates:`, `Holidays:`, `Gems:`) so the cache prefix is long.

This shaves ~30% off cold-cache latency on a warm-cache rerun of the same prompt.

### Parallelism

Three opportunities for parallel work:

1. **After Listener** — Web Pulse + Maps Crowd Radar + Wellness Pulse run concurrently. All three want the candidate set but produce independent outputs.
2. **Inside Web Pulse** — Tavily + Exa fire in parallel; Firecrawl scrapes top 3 concurrently with each other.
3. **After Planner** — Weather Watcher + Verifier run in parallel; they take the same planner output but compute independent things.

Total wall-clock with parallelism: ~25 s. Without (if everything were sequential): ~45 s.

---

## What didn't work (the burned-by-this list)

Documented in detail in [`AGENTS.md`](../AGENTS.md) "Don't break". Brief recap of the painful ones:

1. **TAT keyword search via Node fetch returns empty data.** It hits a Cloudflare BKK edge that returns no results, while curl resolves to a healthy SIN edge. Enrichment scripts use bash + curl + python deliberately. Don't "modernize" them to Node fetch.
2. **No `startedRef` guard in the discover page's `useEffect`.** React 19 Strict Mode double-mounts; a "fetch only once" ref blocks the second mount when the first was aborted, leaving agents stuck idle. The cancel-via-AbortController pattern is correct.
3. **Open-Meteo's 16-day horizon is hard.** Trips beyond that skip Weather Watcher with a "beyond forecast horizon" message. Don't fall back to repeating the last available forecast — that fabricates data.
4. **Google Places is a popularity proxy, not "busy now".** Copy must say "popularity proxy" / "review volume suggests", never "currently crowded".
5. **`stays[].nights` from the Planner is unreliable.** Gemini sometimes equates nights with days. Always go through `normalizeStayNights`.
6. **Customer copy is curated.** No vendor names (Tavily/Exa/Firecrawl), no data-layer attribution (TAT SHA / Forbes / Condé Nast), no debug states ("missing-key", "editorial ok"), no agent names (Web Pulse, Verifier) in `/discover` or the crew-panel chips. The cross-validation runs; it just doesn't show up in copy. Per-card award badges (e.g. "Forbes Travel Guide 2024") stay — those are trust signals.

---

## Where to read further

- [`design-flow.md`](design-flow.md) — UX flow, screen-by-screen
- [`wellness-data-sources.md`](wellness-data-sources.md) — wellness cross-validation rules, maintenance cadence
- [`AGENTS.md`](../AGENTS.md) — code-level conventions, "Don't break" list, adding new agents/gems/wellness venues
- [`CLAUDE.md`](../CLAUDE.md) — quick rules for AI assistants working in this repo
- [`README.md`](../README.md) — project pitch, setup, deploy
