# Hidden Siam

> Eight specialised AI agents collaborate to surface authentic Thai destinations the famous travel bots never recommend — and pair them with hand-picked Thai wellness venues, all cross-validated against four data sources.

Built for the **Thailand Tourism Mini Hackathon** (AI Hackathon SS6, May 2026).  
**Production-deployed on Railway.**

---

## The problem

### Overtourism is destroying the places people come to see

Maya Bay was closed for four years. Phi Phi is a parking lot of long-tail boats. Damnoen Saduak is now staged for cruise buses. Pai has 6,000 guesthouses.

The same dozen places get recommended by every platform — and every general-purpose AI assistant makes it worse. ChatGPT, Gemini, Perplexity: they all recommend Wat Pho, Railay, and the Chiang Mai Night Bazaar. That's not useful. That's amplification.

### The specific pain points we set out to fix

| Pain point | Why it matters |
| --- | --- |
| **AI bots recommend the busiest places** | Their training data skews toward high-review, high-mention venues — which are the most crowded ones |
| **No crowd awareness** | Standard itinerary tools don't model how packed a place actually is |
| **Mass-market wellness recs** | "Best spa in Chiang Mai" returns Let's Relax chains, not the Royal Thai herbal compress retreats |
| **No freshness signal** | A blog from 2019 is treated the same as a post from last week |
| **One-size itineraries** | Tools don't ask how you want to travel — nature vs culture vs wellness vs adventure all get the same template |
| **Famous traps with no alternatives** | Tools warn you about nothing. They have no concept of "here's what to visit instead" |

---

## The solution

Hidden Siam is a **multi-agent AI travel planner** that works against the grain. Instead of retrieving the most popular answer, it:

1. **Asks how you want to travel first.** Before running the 8-agent pipeline, a Gemini-powered path selector generates 3–4 distinct trip philosophies from your brief — you pick the one that fits. The agents then run with your intent, not a generic template.

2. **Starts from a curated anti-overtourism dataset.** 91 hidden gems and 89 Thai wellness venues, hand-vetted across all 77 provinces, each with crowd scores and authenticity ratings.

3. **Runs live web search and Google Places against that dataset.** Not as a replacement — as a freshness and validation layer. Every agent has a specific job in a chain that argues, filters, and cross-checks before anything reaches you.

4. **Flags the traps.** 30 known tourist traps with curated "better alternative" gems. The Crowd Analyst surfaces warnings when your route overlaps.

5. **Shows you the work, live.** Every agent streams its thinking and narration via Server-Sent Events. You see the crew running in real time — not a spinner for 25 seconds.

---

## How it works

### Step 1 — Choose your path

After you submit your brief, a fast Gemini call generates **3–4 alternative travel paths** before the full pipeline runs. Each path represents a different travel philosophy — wild nature vs cultural immersion vs wellness retreat vs adventure — and comes with a refined intent that steers all 8 agents.

You pick the one that fits. Or skip and let the agents decide.

### Step 2 — The 8-agent pipeline runs

```
User prompt + chosen path + start date
              │
       [ Orchestrator ]
              │
     ┌────────▼────────┐
     │  Local Listener  │  → 8–12 candidate gems from curated dataset
     └────────┬────────┘
              │
 ┌────────────┼───────────────────┐
 ▼            ▼                   ▼
Web Pulse   Maps Crowd Radar    Wellness Pulse
(Tavily +   (Google Places      (curated dataset
 Exa +       review volume,      → filtered by trip
 Firecrawl)  open status,        provinces → Google
             distance)           Places validation)
 │            │                   │
 validations  pressure            0–5 wellness picks
 + live       scores              cross-validated:
 finds                            rating ≥4.3,
 (geocoded)                       reviews ≥100,
                                  OPERATIONAL
              │
       ┌──────▼──────┐
       │ Crowd Analyst│  → filters by crowd tolerance, flags traps
       └──────┬───────┘
              ▼
       ┌─────────────┐
       │   Curator    │  → scores each gem by vibe + web evidence
       └──────┬───────┘
              ▼
       ┌─────────────┐
       │   Planner    │  → 1–2 bases, slow travel, day-by-day itinerary
       └──────┬───────┘
              │
      ┌───────┴───────┐
      ▼               ▼
Weather Watcher     Verifier          (parallel)
(Open-Meteo         (seasons, Thai
 16-day forecast)    holidays,
                     etiquette tips)
              │
              ▼
   Final itinerary  +  Live finds sidebar  +  Thai Wellness Picks sidebar
   (streamed via Server-Sent Events)
```

### Step 3 — Streamed live, not batched

Every agent emits a narration sentence as it finishes. The UI shows the crew panel updating in real time — agent by agent — so the user sees exactly what is happening instead of waiting for a wall of text.

End-to-end: **~25 seconds** with all APIs enabled.

---

## Features

### Trip path selection (Ways)

Before any agent runs, Gemini generates 3–4 distinct travel "ways" from your brief. Each card shows:
- Title and one-line tagline
- 2-sentence description of what this version of the trip prioritises
- 2–3 theme tags
- A precise refinement instruction that steers all 8 agents

Skipping is always available — "Let the agents decide" goes straight to the pipeline.

### Live agent crew panel

A collapsible panel shows each of the 8 agents by name, with status badges (`thinking → done`), elapsed time, and a streamed narration sentence. Each agent has its own accent color in the UI (saffron / jade / burgundy / gold).

### Day-by-day itinerary

The Planner builds a structured plan with:
- **1–2 base towns** (slow travel — fewer moves, deeper experience)
- **Morning and afternoon** slots: place name + specific activity
- **Dinner**: a real local restaurant recommendation with a one-line reason
- Travel day markers between base changes

### Interactive map

A react-leaflet map with CARTO light tiles and saffron pins plots every gem in the itinerary. Clicking a pin opens a popup with the place name and a Google Maps link.

### Crowd radar

The Crowd Analyst combines:
- Curated `crowd_level` scores (1–5, hand-rated)
- Google Places review volume (high volume = high footfall proxy)
- Business status and open-now signal
- Trip calendar pressure (weekend vs weekday, Thai public holidays)
- Web Pulse tourism-pressure term frequency

Result: a deterministic `pressure_score` per gem (`low / medium / high / unknown`) shown on every gem card.

### Tourist trap warnings

30 known traps (Phi Phi, Damnoen Saduak, Erawan's first tier, etc.) with curated `better_alternatives`. The Crowd Analyst surfaces these as inline warnings in the agent stream when the user's route overlaps. Each warning includes the specific alternative gem.

### Thai wellness picks sidebar

Wellness Pulse selects 0–5 venues from the curated dataset within 80 km of the trip, biased toward:
- SHA Plus / Extra Plus certified venues
- Thai-owned and Thai-heritage brands
- Authentic techniques: Lanna herbal compress, Royal Thai medicine, monastery-led meditation, natural Thai onsen, traditional midwifery massage

Each pick is cross-validated at request time via Google Places (rating ≥4.3, ≥100 reviews, OPERATIONAL). The sidebar is only shown when at least one venue passes.

Each wellness card shows:
- SHA tier badge (Plus / Extra Plus)
- Award badges (Forbes Travel Guide, Condé Nast Traveller, Travel + Leisure, World Spa Awards)
- Thai authenticity score (1–5 stars)
- Signature treatments list
- Price tier
- Maps link + booking URL (when available)

### Live finds sidebar

Web Pulse proposes up to 5 places named in fresh Thai-source search hits that are **not in the curated dataset**. Each is geocoded via Google Places (6-second timeout; unresolvable drops silently). Live finds appear in a "What the web found" sidebar — clearly labeled as leads, not vetted picks, with their source URL.

### Weather integration

Open-Meteo provides a free 16-day forecast (no API key required). The Weather Watcher maps each itinerary day to a forecast datapoint and adds a "swap suggestion" when a day looks rainy. If the trip starts beyond the 16-day horizon, Weather Watcher is skipped with an explicit message — no fabricated data.

### Thai holiday awareness

A hardcoded 2026/2027 Thai public holiday calendar flags when the trip overlaps. The Verifier incorporates this into its tips (temples crowded, roads slow, market closures). Holiday warnings surface as chips on affected itinerary days.

### TAT verification

57 of 91 gems and 18 of 89 wellness venues carry a TAT enrichment block — pulled offline from the Tourism Authority of Thailand API (lat/lng-validated within 50 km to avoid same-name place collisions). This provides:
- TAT-verified thumbnail image
- SHA certification status
- Official place slug and detail URL

### Image handling

Each card tries TAT thumbnail first, then falls back to a Google Places photo resolved server-side (`skipHttpRedirect=true` — the API key never appears in a client URL). When a TAT URL 404s at runtime, the `<img onError>` handler flips to the Google fallback automatically.

---

## Datasets

| File | Entries | Province coverage | TAT-enriched |
| --- | ---: | ---: | ---: |
| `data/hidden_gems.json` | **91** gems | **77 / 77** provinces | 57 |
| `data/wellness_local.json` | **89** venues | **77 / 77** provinces | 18 |
| `data/tourist_traps.json` | **30** traps | 18 provinces | — |

**Wellness venue types:** spa · wellness-resort · thai-massage-school · meditation-retreat · onsen · yoga-retreat · traditional-medicine · herbal-sauna

### Wellness data: four-layer validation

Every venue must clear ≥2 layers before entering the dataset (full rules in [docs/wellness-data-sources.md](docs/wellness-data-sources.md)):

| Layer | Source | What it certifies |
| --- | --- | --- |
| 1. Editorial base | Curated `data/wellness_local.json` | Quality, Thai character, hand-selected from Forbes / Condé Nast / Travel + Leisure |
| 2. Government verify | TAT API SHA Plus / Extra Plus | Safety and standards by Tourism Authority of Thailand |
| 3. Editorial freshness | Tavily / Exa on luxury domains | Award status, current standing (cntraveler, forbestravelguide, tatlerasia, etc.) |
| 4. Consumer reality | Google Places at request time | Currently operating, rating ≥4.3, ≥100 reviews, within 15 km of curated coords |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16** App Router (Turbopack) | SSE streaming, server-side API routes, edge-ready |
| AI | **Vercel AI SDK v6** + `@ai-sdk/google` | `generateObject` with Zod schemas; `thinkingConfig.thinkingLevel` for Gemini 3.x |
| Model | **Gemini 3.1 Flash Lite** (all agents) | Tuned for <5s per agent on complex nested schemas; Pro 3.1 timed out at 60s+ |
| Web search | **Tavily + Exa + Firecrawl** | Live Thai-source evidence; per-hit `evidence_level` (snippet vs page-scrape) |
| Places | **Google Places (New)** | Crowd radar, wellness validation, geocoding, photo URI resolution |
| Weather | **Open-Meteo** | Free, no API key, 16-day forecast |
| Map | **react-leaflet** + CARTO light tiles | No Maps key needed for the map itself |
| Styling | **Tailwind CSS v4** + CSS variables | Design tokens in `app/globals.css` under `@theme inline`; no `tailwind.config.js` |
| Animation | **Framer Motion** | Agent panel transitions |
| Validation | **Zod** | Structured agent output contracts |
| Deploy | **Railway** | `railway.json` + `nixpacks.toml` wired; PORT injected automatically |

---

## Setup

```bash
git clone <repo>
cd travel_hack_04
npm install
cp .env.local.example .env.local    # add your keys
npm run dev                          # http://localhost:3000
```

### Environment variables

| Variable | Required | Where to get it |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | **Yes** | https://aistudio.google.com/ (free tier: 1,500 req/day) |
| `TAVILY_API_KEY` | Recommended | https://tavily.com — Web Pulse live search |
| `EXA_API_KEY` | Recommended | https://exa.ai — Web Pulse + Wellness Pulse editorial boost |
| `GOOGLE_MAPS_API_KEY` | Recommended | Google Cloud Console, Places API (New) enabled, server-allowed (no browser restriction) |
| `FIRECRAWL_API_KEY` | Optional | https://firecrawl.dev — page-level evidence in Web Pulse |
| `TAT_API_KEY` | Optional | https://tatdataapi.io/ — offline TAT enrichment scripts only |

Without optional keys the app still runs — agents emit empty/skipped diagnostics and the rest of the pipeline continues.

---

## Demo prompts

```
3 days in Chiang Mai. I love nature, hate crowds, vegan-friendly.
Weekend escape from Bangkok — peaceful, no tourist traps, good food.
An alternative to Phi Phi for a week. Clear water, no jet skis, sunsets.
Relaxing wellness trip to Chiang Mai for 4 days, want a Thai spa or onsen.
10 days exploring temples and culture, but not the Bangkok rush.
```

---

## Deploy on Railway

`railway.json` + `nixpacks.toml` are already wired. Connect this repo to Railway, set env vars from `.env.local.example`, and Railway auto-detects Next.js and runs `npm run build && npm run start`. PORT is injected automatically.

Use a server-allowed Google Maps key (no browser/referrer restriction) for Places API calls.

---

## Project structure

```
app/
  page.tsx                    Landing — prompt + date picker
  ways/page.tsx               Path selection — 3–4 trip ways, user picks one
  discover/page.tsx           Live agent stream + final itinerary view
  api/ways/route.ts           POST — fast Gemini call to generate trip ways
  api/orchestrate/route.ts    POST — SSE endpoint that runs the 8-agent crew

lib/
  ai.ts                       Gemini provider config + per-agent model picks
  types.ts                    HiddenGem, WellnessVenue, AgentEvent, FinalItinerary, ...
  agents/
    prompts.ts                System prompts for each agent (the product quality lives here)
    schemas.ts                Zod output schemas
    runners.ts                One function per agent (runListener, runWebPulse, ...)
    orchestrator.ts           Composes the run, emits SSE events, decorates days
  web-search.ts               Tavily + Exa + Firecrawl wrappers + luxuryWellnessSearch
  google-maps.ts              Places (New): crowd signals, geocoding, wellness validation, photos
  crowd-radar.ts              Deterministic crowd-pressure scoring (Maps + calendar + Web Pulse)
  weather.ts                  Open-Meteo client (free, no API key)
  thai-holidays.ts            Hardcoded 2026/2027 holidays + range helper

components/
  AgentCrewPanel.tsx          Collapsible 8-agent stream panel with realtime diagnostic chips
  GemCard.tsx                 Gem card: TAT image, SHA badge, crowd proxy chip, Maps link
  WellnessCard.tsx            Wellness card: SHA tier, awards, authenticity stars, treatments
  ItineraryMap.tsx            react-leaflet map (dynamic, ssr: false)
  ui/                         Button, Card, Badge, Textarea

data/
  hidden_gems.json            91 curated gems — all 77 provinces, 57 TAT-enriched
  wellness_local.json         89 wellness venues — all 77 provinces, 18 TAT-enriched
  tourist_traps.json          30 known traps + better_alternatives

docs/
  wellness-data-sources.md    Four-layer validation rules + maintenance cadence

scripts/
  enrich-tat.sh               Pull TAT data for gems (curl-based — must stay curl, see AGENTS.md)
  merge-tat.sh                Validate lat/lng ±50 km, merge into hidden_gems.json
  enrich-tat-wellness.sh      Same pipeline for wellness_local.json
  merge-tat-wellness.sh       Same merge step for wellness venues
  fetch-sha-wellness.sh       Discover SHA Plus candidates from TAT API
```

---

## Why eight agents, not one

A single Gemini call could produce a travel plan. We chose agents deliberately:

- **Separation of concerns** — each agent has one job and one schema. The Crowd Analyst cannot invent a restaurant; the Planner cannot override a crowd filter. Constraints are structural, not prompt-based.
- **Visible reasoning** — streaming SSE means the user watches the crew argue and filter in real time. The work *is* the demo.
- **Parallel validation** — Web Pulse, Maps Crowd Radar, and Wellness Pulse run concurrently against the same candidate set. A sequential call would be 3× slower.
- **Curated trust anchor + live freshness** — 91 hand-vetted gems give us defensible quality. Web Pulse's live finds keep the system useful for prompts outside the curated set without ever letting unvetted places into the planned route.
- **Sidebar isolation** — live finds and wellness picks run in parallel and appear as clearly-labeled sidebars. They never touch the Curator or Planner, so quality of the main itinerary is never diluted by unvalidated data.

---

## License

MIT — built for a hackathon, do whatever you like with it.
