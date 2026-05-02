# Hidden Siam

> A Destination Scout pre-flow helps first-time Thailand travelers choose a region, then eight specialized AI agents build an authentic, less-crowded itinerary the famous travel bots never recommend.

Built for the **Thailand Tourism Mini Hackathon** (AI Hackathon SS6, May 2026).

## The pitch

Maya Bay was closed for four years because of overtourism. Phi Phi is a parking lot of long-tail boats. Damnoen Saduak is staged for cruise tours. And every general-purpose AI travel assistant — ChatGPT, Gemini, you-name-it — keeps recommending exactly those places.

**Hidden Siam** starts with a lightweight **Destination Scout**: the user only describes their travel style, the scout suggests 3-5 Thailand trip clusters, and the user chooses one before the full itinerary run starts. After that, **eight specialized AI agents** run over hand-curated datasets covering all 77 provinces of Thailand: 91 authentic gems, 89 Thai wellness venues, and 30 known tourist traps with better alternatives. Live web search and Google Places augment the curated set; everything cross-validates before it reaches the user. The agents argue, filter, route, and surface restaurant + wellness picks — and the user sees their work happen live over Server-Sent Events.

## Product flow

1. **Home** — user enters only their preferred travel style and trip start date. No province knowledge required.
2. **Destination Scout** — `/api/destination-suggestions` proposes 3-5 polished trip clusters from the curated hidden-gem dataset.
3. **Destination picker** — `/destinations` shows clean customer-facing cards: title, region/provinces, why it fits, what it avoids, and a single "Plan this trip" CTA.
4. **Agent itinerary** — choosing a card sends a composed prompt into `/discover`, where the existing SSE agent crew builds the full route.

See [docs/design-flow.md](docs/design-flow.md) for the detailed UX, data, and system flow.

## Destination Scout pre-flow

| Step | Model / Source | Role |
| --- | --- | --- |
| Destination Scout | Gemini 3.1 Flash Lite + curated hidden gems | Converts a style-only prompt into 3-5 trip clusters. This is a preflight step, not part of the live agent crew shown on `/discover`. |

## The agents

| Agent | Model / Source | Role |
| --- | --- | --- |
| 🔍 Local Listener | Gemini 3.1 Flash Lite | Surfaces 8–12 candidate gems from the curated dataset |
| 🌐 Web Pulse | Tavily + Exa + Firecrawl + Gemini 3.1 Flash Lite | Live-searches Thai travel sources to validate candidates AND propose up to 5 fresh "live finds" outside the curated dataset (geocoded via Google Places) |
| 🍃 Wellness Pulse | Gemini 3.1 Flash Lite + Tavily/Exa luxury domains | Pre-filters wellness venues to within 80 km of the trip, picks 0–5 Thai-character spots (heritage spa, onsen, monastery retreat) — cross-validated by Google Places (rating ≥4.3, reviews ≥100, OPERATIONAL) |
| 📊 Crowd Analyst | Gemini 3.1 Flash Lite + Google Places | Filters by crowd-tolerance using curated data + live Maps signals (review volume, business status), flags tourist traps the user might be heading toward |
| 🎨 Cultural Curator | Gemini 3.1 Flash Lite | Scores each candidate against the user's vibe **plus** Web Pulse's verdicts |
| 🗺️ Route Planner | Gemini 3.1 Flash Lite | Picks 2–4 gems, builds a slow-travel plan with 1–2 bases. Each day has Morning + Afternoon (place + activity) and Dinner (real local restaurant + why) |
| 🌦️ Weather Watcher | Open-Meteo + Gemini 3.1 Flash Lite | Pulls a 14-day forecast for each base, aligns to your trip days, suggests swaps when a day looks rainy |
| ✅ Verifier | Gemini 3.1 Flash Lite | Sanity-checks seasonal closures, etiquette, holiday overlap, adds 2–4 local tips |

End-to-end target: **~25 seconds** with live web + Maps enabled.

## System flow

```
              Style prompt + start date
                         │
                         ▼
           ┌──────────────────────────┐
           │ Destination Scout API     │
           │ /api/destination-         │
           │ suggestions               │
           └─────────────┬────────────┘
                         │ 3-5 trip clusters
                         ▼
           ┌──────────────────────────┐
           │ /destinations picker      │
           │ clean customer cards      │
           └─────────────┬────────────┘
                         │ selected composed_prompt
                         ▼
             Composed prompt + start date
                              │
                       [ Orchestrator ]
                              │
                     ┌────────▼────────┐
                     │ Local Listener  │  (8-12 candidate gems from curated set)
                     └────────┬────────┘
                              │
        ┌─────────────────────┼─────────────────────────┐
        │                     │                         │
        ▼                     ▼                         ▼
  ┌──────────┐         ┌────────────┐          ┌──────────────┐
  │ Web Pulse│         │ Maps Crowd │          │ Wellness     │
  │ (Tavily +│         │ Radar      │          │ Pulse        │
  │  Exa +   │         │ (Google    │          │ (curated     │
  │  Firec.) │         │  Places)   │          │  pre-filter  │
  └──┬───────┘         └──────┬─────┘          │  + Tavily    │
     │ validations[]          │ pressure        │  luxury      │
     │ + discovered_gems[]    │ scores          │  domains)    │
     │ → geocode via Google   │                 └──────┬───────┘
     │   Places, drop fails   │                        │ picks
     │                        │                        │ 0-5 venues
     │                        │                        │ → validate via
     │                        │                        │   Google Places
     │                        │                        │   (rating ≥4.3,
     │                        │                        │    reviews ≥100,
     │                        │                        │    OPERATIONAL)
     │                        │                        │ → resolve photo
     │                        │                        │   URLs (no key
     │                        │                        │   in client URL)
     └────────────┬───────────┴────────────────────────┘
                  ▼
          ┌─────────────────┐
          │ Crowd Analyst   │  (filter, flag traps, drop overcrowded)
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │ Curator         │  (score 0-1 by vibe + web evidence)
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │ Planner         │  (1-2 bases, slow travel, structured days:
          └────────┬────────┘   morning+afternoon = {place, activity},
                   │            dinner = {restaurant, why})
                   │
          ┌────────┴────────┐
          ▼                 ▼
   ┌──────────┐      ┌────────────┐
   │ Weather  │      │ Verifier   │   (parallel)
   │ Watcher  │      │ (seasons,  │
   │ (Open-   │      │  Thai      │
   │  Meteo)  │      │  holidays, │
   └────┬─────┘      │  etiquette)│
        │            └─────┬──────┘
        └────────┬─────────┘
                 ▼
   ┌──────────────────────────────────────────────┐
   │           Final itinerary +                  │
   │           Live finds sidebar +               │
   │           Thai Wellness Picks sidebar +      │
   │           Notes from the local guide         │
   │           (streamed via Server-Sent Events)  │
   └──────────────────────────────────────────────┘
```

The Destination Scout runs before the SSE stream and does not appear in the agent crew panel. It validates generated clusters against `data/hidden_gems.json` and tops up with deterministic low-crowd fallbacks if the model returns fewer than three valid options. Once the user chooses a cluster, the existing itinerary flow starts: Listener sets the candidate pool; Web Pulse, Maps Crowd Radar, and Wellness Pulse run **in parallel** against that exact pool; Curator and Planner reconcile their outputs; Weather Watcher and Verifier run in parallel after the Planner. The Orchestrator routes work between them all and streams progress so the UI shows every step happening live.

## Datasets

| File | Entries | Coverage | TAT-enriched |
| --- | ---: | --- | ---: |
| `data/hidden_gems.json` | **91** gems | All **77** provinces | 57 |
| `data/wellness_local.json` | **89** venues | All **77** provinces | 18 |
| `data/tourist_traps.json` | **30** traps | 18 provinces | — |

Wellness venues span **8 types**: spa, wellness-resort, thai-massage-school, meditation-retreat, onsen, yoga-retreat, traditional-medicine, herbal-sauna.

### Wellness data: how we keep it accurate

Every wellness entry must clear at least 2 of these layers (full rules in [docs/wellness-data-sources.md](docs/wellness-data-sources.md)):

| Layer | Source | What it certifies |
| --- | --- | --- |
| 1. Editorial base | Curated `data/wellness_local.json` | Quality, Thai character, hand-picked from Forbes / Condé Nast / Travel + Leisure |
| 2. Government verify | TAT API SHA Plus / Extra Plus | Safety + standards by Tourism Authority of Thailand |
| 3. Editorial freshness | Tavily/Exa on luxury domains (cntraveler, forbestravelguide, tatlerasia, etc.) | Award status, current standing |
| 4. Consumer reality | Google Places at request time | Currently operating, rating ≥4.3, reviews ≥100, within 15 km of curated coords |

The Wellness Pulse agent reads from layer 1, applies layers 3 (live boost) and 4 (validation) at request time. The TAT enrichment script fills layer 2 offline.

### Image fallback

Each gem and wellness venue tries TAT thumbnail first, then falls back to a Google Places photo (resolved server-side via `skipHttpRedirect=true` so the API key never leaves the server). When a TAT URL 404s at runtime, the `<img onError>` flips to the Google fallback automatically.

## Stack

- **Next.js 16** App Router (Turbopack)
- **Vercel AI SDK 6** + `@ai-sdk/google` for Gemini
- **react-leaflet** + OpenStreetMap (CARTO light tiles) — no Maps key for the map itself
- **Tailwind CSS 4** + Framer Motion for the agent animations
- **Zod** for structured agent output
- **Tavily + Exa + Firecrawl** for live web evidence
- **Google Places (New)** for crowd radar, wellness validation, photos, and discovery geocoding

Three curated JSON files, no database — keeps the deploy footprint trivial.

## Setup

```bash
npm install
cp .env.local.example .env.local      # then add your keys
npm run dev
```

Open http://localhost:3000.

**Required:** Gemini API key from https://aistudio.google.com/ (free tier 1500 req/day — plenty).

**Recommended for full experience:**
- **Tavily** (https://tavily.com) and **Exa** (https://exa.ai) — Web Pulse + Wellness Pulse live boost
- **Firecrawl** (https://firecrawl.dev) — page-level evidence in Web Pulse
- **Google Maps API** with Places API (New) enabled — crowd radar, wellness validation, photo fallbacks
- **TAT_API_KEY** from https://tatdataapi.io/ — for offline enrichment

Without these, the app still works; agents emit empty/skipped diagnostics and the rest of the pipeline runs.

## Demo prompts

```
Peaceful beaches, no party scene, good seafood, 5 days.
Temples, local culture, vegetarian-friendly, hate crowds.
Relaxing wellness trip, Thai spa or onsen, quiet mornings, 4 days.
Family-friendly nature, easy walks, wildlife, not too touristy.
10 days exploring temples and culture, but not the Bangkok rush.
```

## Deploy (Railway)

`railway.json` + `nixpacks.toml` are wired. Connect this repo to Railway, set the env vars from `.env.local.example`, and Railway auto-detects Next.js and runs `npm run build && npm run start`. PORT is injected automatically.

For the full live demo, set `GOOGLE_MAPS_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, and `FIRECRAWL_API_KEY`. Use a server-allowed Maps key (no browser/referrer restriction).

## Project structure

```
app/
  page.tsx                    Landing + style prompt input
  destinations/page.tsx       Customer-facing Destination Scout picker
  discover/page.tsx           Live agent stream + final itinerary view
  api/destination-suggestions/route.ts
                              Destination Scout JSON endpoint
  api/orchestrate/route.ts    SSE endpoint that runs the agent crew
lib/
  ai.ts                       Gemini provider + model picks
  types.ts                    HiddenGem, DestinationSuggestion, WellnessVenue,
                              AgentEvent, ItineraryDay, ...
  web-search.ts               Tavily + Exa + Firecrawl + luxuryWellnessSearch
  google-maps.ts              Places (New) wrapper: crowd signals, geocoding,
                              wellness validation, photo URI resolution
  crowd-radar.ts              Deterministic crowd-pressure scoring
  weather.ts                  Open-Meteo client (free, no API key)
  thai-holidays.ts            Hardcoded 2026/2027 holidays + range helper
  agents/
    prompts.ts                Destination Scout + system prompts for each agent
    schemas.ts                Zod output schemas
    runners.ts                Destination Scout + one function per agent
    orchestrator.ts           Composes the run, emits SSE events,
                              decorates days with weather + holiday
components/
  AgentCrewPanel.tsx          Single collapsible panel for the 8-agent stream
  GemCard.tsx                 Gem card (TAT image / Google fallback,
                              SHA badge, Maps crowd proxy chip)
  WellnessCard.tsx            Wellness venue card (SHA tier, awards,
                              Thai authenticity stars, signature treatments)
  ItineraryMap.tsx            Leaflet map (dynamic, ssr: false)
  ui/*                        Buttons, cards, badges, textarea
data/
  hidden_gems.json            91 curated gems across all 77 provinces
  wellness_local.json         89 wellness venues across all 77 provinces
  tourist_traps.json          30 known traps + better alternatives
docs/
  design-flow.md              Detailed UX + system flow
  wellness-data-sources.md    Layered cross-validation rules + cadence
scripts/
  enrich-tat.sh               Pull TAT data for gems (curl-based; see AGENTS.md "Don't break" #1)
  merge-tat.sh                Validate lat/lng ±50km, merge into gems
  enrich-tat-wellness.sh      Same pipeline for wellness_local.json
  merge-tat-wellness.sh       Same merge step for wellness
  fetch-sha-wellness.sh       Discover candidate SHA Plus wellness from TAT
```

## Where the data shows up

- **Hidden gems** — surface in the main itinerary day-by-day, the Leaflet map, and the "What you're visiting" footer. Each card shows TAT verified badge, Maps crowd-pressure chip, and a clickable Maps link.
- **Destination suggestions** — surface only on `/destinations` as clean customer cards. Style tags and anchor gem ids are kept internal; the selected card contributes a composed prompt to the itinerary agents.
- **Wellness venues** — surface in the "Thai Wellness Picks" sidebar (rendered only when at least one venue passes Google Places validation within 80 km of the trip). Each card shows SHA tier, award badges (Forbes / Condé Nast / Travel + Leisure / World Spa Awards), Thai authenticity stars, signature treatments, and Maps + booking links.
- **Live finds** — Web Pulse's discovered_gems[] surface in a parallel sidebar, marked clearly as leads (not vetted picks).
- **Tourist traps** — flagged in the agent stream when the user's prompt or selected gems point at one. Each warning includes the trap's `better_alternatives` from our curated set.
- **Verifier tips** — promoted to a prominent "Notes from the local guide" footer card with numbered tips on saffron-gold gradient.

## Why this design

- **Scout first, then route** — foreign travelers often do not know Thai provinces. A separate destination picker turns a vague style prompt into a confident choice before spending 20-30 seconds on the live agent crew.
- **Eight agents, not one** — judges in an AI hackathon care about agentic patterns. A single Gemini call would have been simpler but invisible.
- **Curated dataset as trust anchor + live web + Google Places as the freshness layers** — 91 hand-vetted gems and 89 wellness venues give us defensible quality (TAT-verified images, hand-tuned scores). Web Pulse's `discovered_gems[]` keeps the system useful when a user asks about a place we haven't curated yet, while never letting unvetted picks into the planned route. Google Places double-checks "is this still a real, currently-operating, well-rated place?" at request time.
- **SSE streaming, not "wait 25s and show result"** — the visible work *is* the demo.
- **Tourist-trap awareness, not just gem retrieval** — every gem references which famous spot it's an alternative to. The Crowd Analyst surfaces these warnings explicitly.
- **Wellness as a parallel sidebar, not folded into the main itinerary** — keeps the anti-overtourism mandate honest. Curated 5-star wellness picks coexist with the hidden-gem ethos because both are about quality + low-density.
- **Maps links use the visible place text** — the link the user clicks always matches the place name they read, not the planner's internal `gem_id`.

## License

MIT — built for a hackathon, do whatever you like with it.
