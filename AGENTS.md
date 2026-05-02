<!-- BEGIN:nextjs-agent-rules -->
# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
<!-- END:nextjs-agent-rules -->

# Hidden Siam

Multi-agent AI travel planner for Thailand, built against overtourism. A Destination Scout pre-flow helps travellers choose a trip cluster from style-only intent, then eight specialised AI agents collaborate over curated destinations and live Thai-web search to surface routes that the famous travel bots never recommend.

> Built for the Thailand Tourism Mini Hackathon (AI Hackathon SS6, May 2026).
> Production-deployed on Railway.

## What you also need to know

- **Vercel AI SDK v6** — `generateObject` with Zod schemas is how every agent calls Gemini. The Google provider (`@ai-sdk/google`) is configured with `gemini-3.1-flash-lite-preview` + `thinkingConfig.thinkingLevel = "minimal"` for every agent — see `lib/ai.ts` and `lib/agents/runners.ts`.
- **Tailwind CSS v4** — design tokens live in `app/globals.css` under `@theme inline`. There is no `tailwind.config.js`. Use CSS variables (`var(--saffron)`, `bg-[var(--saffron)]`).
- **React 19 + Strict Mode** — `useEffect` runs twice in dev. Don't add ref-guards to "fetch only once" — they break the second mount silently when the first is aborted (we got burned; see "Don't break" below).
- **Verification — do NOT run the local preview yourself.** The maintainer runs `localhost:3001` in their own browser and checks UI changes manually. Stop after `npx tsc --noEmit` + `npx next build` pass. Skip Claude Preview MCP calls (`preview_eval`, `preview_screenshot`, `preview_snapshot`, etc.), do not auto-navigate the dev server, and do not screenshot the result. If a change is purely visual and the build passes, report what changed and let the maintainer verify.

## Architecture

```
Style prompt + start date
    ↓
Destination Scout pre-flow
    ├─ POST /api/destination-suggestions
    ├─ Gemini 3.1 Flash Lite over slim hidden-gem dataset
    ├─ validates anchor_gem_ids against data/hidden_gems.json
    └─ tops up with deterministic fallback if <3 valid clusters
    ↓
/destinations picker
    ↓ selected composed_prompt + start date
[Orchestrator]
    ↓
 Local Listener            (candidate set from curated data)
    ├─→ Web Pulse          (candidate-focused Thai web search)
    │     ├─ validations[]      → for candidates already in dataset
    │     └─ discovered_gems[]  → fresh places NOT in dataset
    │           ↓
    │       Google Places geocoding (drop unresolvable)
    ├─→ Maps Crowd Radar   (Google Places proxy signals)
    └─→ Wellness Pulse     (curated wellness dataset → Thai-character picks)
                          ↓
                Google Places validation (rating ≥4.3, reviews ≥100, OPERATIONAL)
                + optional luxury-domain editorial boost (Tavily/Exa)
                          ↓
                   Crowd Analyst       (filters + flags traps + crowd pressure)
                          ↓
                      Curator         (scores + uses web evidence)
                          ↓
                      Planner         (1-2 bases, slow travel)
                          ↓
              ┌───────────┴────────────┐
              ↓                        ↓
        Weather Watcher           Verifier              (parallel)
        (Open-Meteo +             (seasons, Thai
         Gemini)                   holidays, etiquette)
              └───────────┬────────────┘
                          ↓
                  Final itinerary + Live finds + Thai Wellness Picks
                  (streamed via SSE)
```

- Destination Scout is a preflight UX step, not a ninth live agent. It does not appear in `AGENT_ORDER` or the `/discover` crew panel.
- `/destinations` is customer-facing: show title, region/provinces, why it fits, avoidance note, and CTA. Keep `style_tags` and `anchor_gem_ids` internal unless debugging.
- Listener runs first so Web Pulse, Maps Crowd Radar, and Wellness Pulse can validate the exact candidate set instead of searching broadly
- Web Pulse + Maps Crowd Radar + Wellness Pulse run in parallel after the Listener — live Thai-web visibility + Google Places popularity/open-status proxies + curated Thai wellness picks
- Web Pulse also proposes up to 5 `discovered_gems[]` — places named in fresh Thai-source hits that are NOT in the curated dataset. The orchestrator geocodes each via Google Places and drops anything unresolvable. Discoveries DO NOT enter Curator/Planner — they appear as a sidebar "Live finds" panel, labeled clearly as leads, not vetted picks
- Wellness Pulse picks 0-5 venues from `data/wellness_local.json` matching the trip provinces, then the orchestrator validates each via Google Places (rating ≥4.3, reviews ≥100, OPERATIONAL) and drops failures. Optional Tavily/Exa search across luxury-travel domains (`cntraveler.com`, `forbestravelguide.com`, `tatlerasia.com`, etc.) runs in parallel for editorial freshness diagnostics. Wellness picks DO NOT enter Curator/Planner — they appear as a sidebar "Thai Wellness Picks" panel, cross-validated across four data layers
- Crowd Analyst combines curated `crowd_level`, Maps review volume, trip calendar pressure, and Web Pulse tourism-pressure terms before filtering
- Weather Watcher + Verifier run in parallel after the Planner
- All steps emit Server-Sent Events; the UI shows each agent live
- End-to-end target: ~20-30 seconds with live web + Maps enabled, `gemini-3.1-flash-lite-preview`, and `thinkingLevel: "minimal"`

## Where things live

| Path | Purpose |
| --- | --- |
| `lib/agents/orchestrator.ts` | Composes the run, emits SSE events, decorates days with weather + holiday |
| `lib/agents/runners.ts` | Destination Scout + one function per agent (`runDestinationScout`, `runListener`, `runWebPulse`, `runWellnessPulse`, `runCrowdAnalyst`, `runCurator`, `runPlanner`, `runWeatherWatcher`, `runVerifier`) |
| `lib/agents/prompts.ts` | Destination Scout + system prompts — **the language quality of the demo lives here** |
| `lib/agents/schemas.ts` | Zod output schemas for `generateObject` |
| `lib/ai.ts` | Gemini provider config + per-agent model picks |
| `lib/web-search.ts` | Tavily + Exa + Firecrawl HTTP wrappers + freshness/provider diagnostics + `luxuryWellnessSearch` for editorial domains |
| `lib/google-maps.ts` | Google Places (New) text-search wrapper — `fetchMapsCrowdSignals` for crowd radar, `geocodeDiscoveredPlace` for Web Pulse live finds, `validateWellnessVenue` for Wellness Pulse cross-validation |
| `lib/crowd-radar.ts` | Deterministic crowd-pressure scoring: Maps + trip calendar + Web Pulse terms |
| `lib/weather.ts` | Open-Meteo client (free, no API key) |
| `lib/thai-holidays.ts` | Hardcoded 2026/2027 holidays + range helper |
| `lib/types.ts` | Shared types: `HiddenGem`, `DestinationSuggestion`, `DiscoveredGem`, `WellnessVenue`, `AgentEvent`, `FinalItinerary`, `ItineraryDay`, `ThaiHolidayHit`, `DayWeather`, `WebEvidence`, `MapsCrowdReport` |
| `data/hidden_gems.json` | 91 curated gems across all 77 provinces |
| `data/tourist_traps.json` | 30 known traps + their better alternatives |
| `data/wellness_local.json` | 89 curated Thai wellness venues across all 77 provinces. See `docs/wellness-data-sources.md` for source & maintenance |
| `app/api/destination-suggestions/route.ts` | JSON endpoint for Destination Scout pre-flow |
| `app/api/orchestrate/route.ts` | SSE endpoint, validates input, calls the orchestrator |
| `app/page.tsx` | Landing — style prompt + date picker |
| `app/destinations/page.tsx` | Customer-facing Destination Scout picker before `/discover` |
| `app/discover/page.tsx` | Live agent stream + final itinerary view (includes "Thai Wellness Picks" sidebar). Smooth-scrolls the result section to the viewport top ~250ms after `final` arrives, after the AgentCrewPanel collapse animation settles. Sticky header is logo-only; gems/traps stat lives in `ItineraryHero` to avoid duplication. |
| `components/AgentCrewPanel.tsx` | Single collapsible panel for the 8-agent stream. Auto-collapses once all rows finish (`useEffect` on `allDone`); user can re-expand. Diagnostic chips intentionally omit vendor names (Tavily / Exa / Firecrawl) and debug states ("editorial missing-key") — see CLAUDE.md "Customer copy is curated". |
| `components/GemCard.tsx` | Gem card with TAT image, verified badge, popularity proxy chip ("{level} traffic"), review count, and Maps link. Source attributions ("Google Maps" hero badge, "Google reviews" label, "Maps {pressure}") deliberately omitted. |
| `components/WellnessCard.tsx` | Wellness venue card — SHA tier badge, awards block, Thai authenticity stars, signature treatments, Maps + booking links |
| `components/ItineraryMap.tsx` | react-leaflet map with light CARTO tiles + saffron pin |
| `scripts/enrich-tat.sh` + `merge-tat.sh` | Offline TAT data enrichment for gems (curl-based; see "Don't break" #1) |
| `scripts/enrich-tat-wellness.sh` + `merge-tat-wellness.sh` | Same pipeline for wellness venues — separate scripts so they read/write `data/wellness_local.json` |
| `scripts/fetch-sha-wellness.sh` | Discover candidate Thai wellness venues from TAT API filtered for SHA Plus / Extra Plus (curl-based) |
| `docs/design-flow.md` | Detailed UX + system design flow |
| `docs/wellness-data-sources.md` | Layered cross-validation rules + maintenance cadence for `data/wellness_local.json` |

## Conventions

### Prompts (`lib/agents/prompts.ts`)
- Agents speak in **first person** ("I have selected...", "I am parking you in...")
- Each prompt explicitly instructs a `narration` field — one sentence, English, what the user sees streamed live
- Prompts include **rules of thumb** ("always keep at least 5 gems", "1-2 bases max for short trips", "prefer concentration over coverage")
- Destination Scout is the exception to the live narration pattern: it returns `DestinationSuggestion[]` for `/destinations`, not a crew-panel event. It must suggest trip clusters, not province-only labels or one exact place.
- Web Pulse and Curator must be precise about freshness: only call evidence "recent" if a source has `published_at`; undated hits are "live-search visibility" or "indexed visibility"
- Web Pulse outputs two separate arrays: `validations[]` (must use a `gem_id` from the candidate set) and `discovered_gems[]` (places NOT in the dataset, max 5). Don't merge them in the prompt — the geocoding step depends on this separation
- Wellness Pulse picks 0-5 ids from `data/wellness_local.json`, biased toward Thai-owned / Thai-heritage brands and SHA Plus / Extra Plus. The prompt forbids mass-market chains (Let's Relax, Health Land, So Thai Spa). Empty array is a valid response when the trip has no wellness intent — better than forcing irrelevant venues
- Crowd Analyst must never claim Google Maps gives a live crowd count. Maps signals are popularity/open-status proxies only: review volume, business status, open now, match distance
- Verifier and Weather Watcher receive structured context (trip dates, holidays, forecasts) in the user `prompt`, not the system prompt — the system prompt stays static for prompt-cache friendliness

### Models (`lib/ai.ts`)
- **Default for Destination Scout and every live agent:** `gemini-3.1-flash-lite-preview` with `thinkingConfig.thinkingLevel = "minimal"`. This was tuned the hard way — Pro 3.1 + structured output timed out at 60s+, Flash 3 was also slow on planner schemas; Flash Lite 3.1 + minimal thinking lands every prompt in <5s per agent.
- If you experiment with another model, the planner schema (optional `days[]` with nested morning/afternoon/dinner) is the latency hot-spot — re-test that one specifically before switching the default.

### Design system — "Jasmine Modern" (`app/globals.css`)
Light theme inspired by Thai luxury hospitality.

| Token | Hex | Use |
| --- | --- | --- |
| `--background` | `#faf6ef` | warm cream page background |
| `--surface` | `#ffffff` | cards / panels |
| `--saffron` | `#b45309` | primary — monk-robe / temple paint |
| `--jade` | `#0f766e` | secondary — mountain water |
| `--burgundy` | `#7f1d1d` | accent — Thai red |
| `--gold` | `#b08240` | metallic highlight |
| `--foreground` | `#1c1917` | warm near-black text |
| `--border` | `#ebe4d4` | subtle warm border |

- Typography: **Fraunces** (variable serif, opsz + SOFT axes) for display + **Geist Sans** for body + **Geist Mono** for labels and dates
- Use CSS variables for color (`bg-[var(--saffron)]`) — direct hex / Tailwind palette colors are out of brand
- Prefer **shadow over hard border** for hierarchy (`shadow-[var(--shadow-sm)]`)
- Section eyebrows are `font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]`
- Each agent in the crew panel has its own accent (saffron / jade / burgundy / gold) — see `components/AgentCrewPanel.tsx` `META`

### Data shape
- `HiddenGem` has optional `tat?: TatEnrichment` — `place_id`, `slug`, `thumbnail_url`, `sha_certified`, `province_th`, `detail_url`, `distance_km`
- `DestinationSuggestion` carries customer-facing fields (`title`, `subtitle`, `provinces`, `region`, `why`, `avoidance_note`, `composed_prompt`) plus internal fields (`anchor_gem_ids`, `style_tags`). Do not expose the internal fields in the polished picker UI.
- TAT enrichment is **lat/lng-validated** — within 50km of the gem's recorded coordinates, otherwise dropped (the keyword search occasionally returns same-named places in different provinces; e.g. "เกาะหมาก" exists in both Trat and Phatthalung)
- `WebEvidence` carries `searched_at`, `freshness_note`, per-provider status, source counts, per-hit `evidence_level` (`search-snippet` vs `page-scrape`), and an optional `discovered_gems[]` populated only when Web Pulse proposed places outside the curated dataset and they geocoded cleanly
- `DiscoveredGem` carries `lat`/`lng` from Google Places, the `source_url` from the original Thai-source hit, plus optional `google_maps_uri`, `google_review_count`, and `google_rating`. No `crowd_level`/`auth_score` — discoveries are not vetted and never enter Curator/Planner
- `MapsCrowdReport` carries one `MapsCrowdSignal` per Listener candidate. `pressure_score` is deterministic and combines calibrated Maps review volume, weekend/holiday pressure, and Web Pulse tourism-pressure terms
- `MapsCrowdSignal.pressure` is a proxy (`low` / `medium` / `high` / `unknown`), not a live crowd reading. Keep this wording in UI and prompts

## Don't break (the "burned by this" list)

1. **TAT keyword search is flaky from Node's fetch.** It hits a Cloudflare BKK edge that returns empty data, while `curl` resolves to a healthy SIN edge. The enrichment scripts (`scripts/*-tat.sh`) deliberately use bash + curl + python for this reason. Don't "modernize" them to Node fetch — you'll get zero matches.
2. **No `startedRef` guard in the Discover page's `useEffect`.** React Strict Mode double-mount aborts the first fetch; a "fetch only once" ref blocks the second mount and the agents stay idle forever. The cancel-via-`AbortController`-in-cleanup pattern is correct as written; don't re-add the ref.
3. **Destination Scout cards are customer-facing.** Keep them clean: no `style_tags`, no `anchor_gem_ids`, no debug reasoning. The selected card's `composed_prompt` carries technical detail forward to `/discover`.
4. **Open-Meteo forecast horizon = 16 days.** When `tripStart > today + 16 days`, the orchestrator skips the Weather Watcher step and emits a "beyond forecast horizon" message. Don't fall back to repeating the last available forecast — that fabricates data and was caught in testing.
5. **Google Places is a proxy, not "busy now".** The Places fields we use do not expose official live crowd counts. Review volume/open status can move candidates from keep → caution/drop, but copy must convey it's a proxy. The customer-facing chip on `GemCard` reads "{pressure} traffic" with the tooltip "Popularity proxy based on review volume, not a live crowd count." — don't reintroduce "Maps {pressure}" or "Google Maps" branding into customer-visible labels (it's still fine in agent prompts and internal types).
6. **No keys in tracked files.** `.env*` is gitignored. The deploy reads from Railway env vars; the enrichment scripts read from `.env.local`. Don't paste keys into source, comments, commit messages, or docs. Rotate after demo.
7. **`stays[].nights` from the Planner is unreliable on its own.** Gemini sometimes equates nights with days, or names the wrong gem_id in `days[].stay_at` (the afternoon stop instead of the sleep base). The orchestrator's `normalizeStayNights` is the source of truth: total nights = `days.length - 1`, distributed across stays via `days[].stay_at` matching when totals reconcile, round-robin fallback otherwise (each base gets at least one night). Don't render raw `planner.stays[].nights` directly — always go through the normalized output.
8. **Customer copy is curated — see CLAUDE.md.** No vendor names, no data-layer attribution footers, no debug states. The crew panel and `/discover` were polished for this; future UI passes should hold the line.

## Adding things

### A new gem
1. Append to `data/hidden_gems.json` — required: `id`, `name_th`, `name_en`, `province`, `region`, `lat`, `lng`, `category`, `vibe_tags`, `crowd_level` (1-5), `auth_score` (1-5), `best_time`, `thai_description`, `en_description`, `source_urls`, `near_traps`
2. Run `bash scripts/enrich-tat.sh && bash scripts/merge-tat.sh` to attach the `tat` block + image (lat/lng-validated automatically)
3. The Listener system prompt does not need changes — it reads the dataset live each request

### A new agent
1. Add to the `AgentName` union in `lib/types.ts`
2. Add a Zod schema in `lib/agents/schemas.ts`
3. Add the system prompt in `lib/agents/prompts.ts` (first person, with `narration` rule)
4. Add a `runX` function in `lib/agents/runners.ts`
5. Wire into `lib/agents/orchestrator.ts` — decide whether it's sequential or part of a `Promise.all`
6. Add a `META` entry in `components/AgentCrewPanel.tsx` (icon + Thai accent color)
7. Add to `AGENT_ORDER` in `app/discover/page.tsx`

### Tuning Destination Scout
- Schema: `destinationSuggestionOutputSchema` in `lib/agents/schemas.ts`.
- Prompt: `DESTINATION_SCOUT_PROMPT` in `lib/agents/prompts.ts`.
- Runner: `runDestinationScout`, `normalizeDestinationSuggestions`, and `buildFallbackDestinationSuggestions` in `lib/agents/runners.ts`.
- API: `app/api/destination-suggestions/route.ts`.
- UI: `app/page.tsx` collects style intent; `app/destinations/page.tsx` renders clean cards and sends the selected `composed_prompt` into `/discover`.
- Fallback exists intentionally. If the model returns invalid ids, duplicates, or fewer than three valid clusters, deterministic scoring tops up with low-crowd, high-authenticity clusters from `data/hidden_gems.json`.

### A new tourist trap
Append to `data/tourist_traps.json` with `id`, `name_en`, `name_th`, `province`, `why_avoid`, `better_alternatives`. The Crowd Analyst will pick it up automatically when a gem references it via `near_traps`.

### A new wellness venue
1. Verify against the editorial criteria in `docs/wellness-data-sources.md` — must clear ≥2 of: TAT SHA Plus, Tier 1 award listing (Forbes / Condé Nast / Travel + Leisure / World Spa Awards), Google Places ≥4.3 / ≥100 reviews. Must have a Thai-character signature (Lanna, Royal Thai medicine, herbal compress, monastery-led, natural Thai onsen).
2. Append to `data/wellness_local.json` — required: `id`, `name_th`, `name_en`, `province`, `region`, `lat`, `lng`, `wellness_type`, `signature_treatments`, `price_tier`, `thai_authenticity` (1-5), `crowd_level` (1-5), `sha_certified`, `awards`, `languages`, `local_character`, `en_description`, `th_description`, `source_urls`. Optional: `sha_tier`, `booking_url`.
3. Run `bash scripts/enrich-tat-wellness.sh && bash scripts/merge-tat-wellness.sh` to attach TAT thumbnail + SHA cert (parallel pipeline to gems — lat/lng-validated automatically).
4. Optional: `bash scripts/fetch-sha-wellness.sh` writes candidate suggestions from TAT to `/tmp/sha_wellness_candidates.json` for the next manual review pass.
5. The Wellness Pulse system prompt does not need changes — it reads the dataset live each request.

### A new agent's data layer
The Wellness Pulse pattern is the template for any future "parallel sidebar" agent that uses a curated dataset + cross-validation:
1. Add a curated `data/<thing>.json` + types in `lib/types.ts`.
2. Add a Zod schema in `lib/agents/schemas.ts` with `narration` + `picks[]`.
3. Add a system prompt in `lib/agents/prompts.ts` with the "empty array is valid" rule.
4. Add a `runX` runner that loads the dataset, slims it for the model, and returns `{ output, liveBoost }`.
5. Run it in parallel with `runWebPulse` in `lib/agents/orchestrator.ts`. Cross-validate via Google Places before attaching to the final itinerary.
6. Add a sidebar panel to `app/discover/page.tsx` and a new card component to `components/`.

### Tuning live finds (Web Pulse discoveries)
- Cap is set in the schema: `webPulseOutputSchema.discovered_gems.max(5)` in `lib/agents/schemas.ts`. Raise/lower there.
- The discovery prompt rule lives in `WEB_PULSE_PROMPT` (`lib/agents/prompts.ts`) — it forbids famous tourist names so the anti-overtourism mandate still holds for live finds.
- Geocoding timeout is 6s in the orchestrator. Anything that fails to resolve via Google Places is dropped silently (the user only sees gems with confirmed coordinates and a Maps link).
- Without `GOOGLE_MAPS_API_KEY`, geocoding is skipped and `discovered_gems[]` will always be empty — the validations path still works.

## Local development

```bash
cp .env.local.example .env.local      # add at minimum GOOGLE_GENERATIVE_AI_API_KEY
npm install
npm run dev                             # http://localhost:3000 (or 3001 if 3000 taken)
```

For the Web Pulse agent to actually search live, also set `TAVILY_API_KEY` and `EXA_API_KEY`. Without them the agent emits an empty result and the rest of the pipeline still runs.

For Crowd Radar, set `GOOGLE_MAPS_API_KEY` with Places API (New) enabled. The app uses it server-side to call `places:searchText` with field masks for place identity, open status, business status, rating, review count, type, Maps URI, and location. If the key is browser/referrer-restricted, create a server-allowed key for local/Railway.

## Deploy (Railway)

`railway.json` + `nixpacks.toml` are wired. Connect this repo to Railway, set env vars from `.env.local.example`, Railway auto-detects Next.js and runs `npm run build && npm run start`. PORT is injected automatically. Set `GOOGLE_MAPS_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, and `FIRECRAWL_API_KEY` for the full realtime demo.
