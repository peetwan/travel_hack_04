<!-- BEGIN:nextjs-agent-rules -->
# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
<!-- END:nextjs-agent-rules -->

# Hidden Siam

Multi-agent AI travel planner for Thailand, built against overtourism. Seven specialised AI agents collaborate over a curated dataset of authentic destinations and live Thai-web search to surface routes that the famous travel bots never recommend.

> Built for the Thailand Tourism Mini Hackathon (AI Hackathon SS6, May 2026).
> Production-deployed on Railway.

## What you also need to know

- **Vercel AI SDK v6** — `generateObject` with Zod schemas is how every agent calls Gemini. The Google provider (`@ai-sdk/google`) supports Gemini 3 with `thinkingConfig.thinkingLevel`. Gemini 2.5 does **not** accept `thinkingLevel` (it 400s); use `thinkingBudget` instead, or omit the option entirely.
- **Tailwind CSS v4** — design tokens live in `app/globals.css` under `@theme inline`. There is no `tailwind.config.js`. Use CSS variables (`var(--saffron)`, `bg-[var(--saffron)]`).
- **React 19 + Strict Mode** — `useEffect` runs twice in dev. Don't add ref-guards to "fetch only once" — they break the second mount silently when the first is aborted (we got burned; see "Don't break" below).

## Architecture

```
User prompt + start date
    ↓
[Orchestrator]
    ├─→ Local Listener  ──┐ (parallel)
    └─→ Web Pulse  ───────┤
                          ↓
                   Crowd Analyst       (filters + flags traps)
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
                  Final itinerary
                  (streamed via SSE)
```

- Listener + Web Pulse run in parallel — curated moat + live ground-truth
- Weather Watcher + Verifier run in parallel after the Planner
- All steps emit Server-Sent Events; the UI shows each agent live
- End-to-end target: ~15 seconds with `gemini-3.1-flash-lite-preview` and `thinkingLevel: "minimal"`

## Where things live

| Path | Purpose |
| --- | --- |
| `lib/agents/orchestrator.ts` | Composes the run, emits SSE events, decorates days with weather + holiday |
| `lib/agents/runners.ts` | One function per agent (`runListener`, `runWebPulse`, `runCrowdAnalyst`, `runCurator`, `runPlanner`, `runWeatherWatcher`, `runVerifier`) |
| `lib/agents/prompts.ts` | System prompts — **the language quality of the demo lives here** |
| `lib/agents/schemas.ts` | Zod output schemas for `generateObject` |
| `lib/ai.ts` | Gemini provider config + per-agent model picks |
| `lib/web-search.ts` | Tavily + Exa + Firecrawl HTTP wrappers |
| `lib/weather.ts` | Open-Meteo client (free, no API key) |
| `lib/thai-holidays.ts` | Hardcoded 2026/2027 holidays + range helper |
| `lib/types.ts` | Shared types: `HiddenGem`, `AgentEvent`, `FinalItinerary`, `ItineraryDay`, `ThaiHolidayHit`, `DayWeather` |
| `data/hidden_gems.json` | 33 curated gems (14 with `tat` enrichment block) |
| `data/tourist_traps.json` | 11 known traps + their better alternatives |
| `app/api/orchestrate/route.ts` | SSE endpoint, validates input, calls the orchestrator |
| `app/page.tsx` | Landing — prompt + date picker + composer |
| `app/discover/page.tsx` | Live agent stream + final itinerary view |
| `components/AgentCrewPanel.tsx` | Single collapsible panel for the 7-agent stream |
| `components/GemCard.tsx` | Gem card with TAT image + verified badge |
| `components/ItineraryMap.tsx` | react-leaflet map with light CARTO tiles + saffron pin |
| `scripts/enrich-tat.sh` + `merge-tat.sh` | Offline TAT data enrichment (curl-based; see "Don't break" #1) |

## Conventions

### Prompts (`lib/agents/prompts.ts`)
- Agents speak in **first person** ("I have selected...", "I am parking you in...")
- Each prompt explicitly instructs a `narration` field — one sentence, English, what the user sees streamed live
- Prompts include **rules of thumb** ("always keep at least 5 gems", "1-2 bases max for short trips", "prefer concentration over coverage")
- Verifier and Weather Watcher receive structured context (trip dates, holidays, forecasts) in the user `prompt`, not the system prompt — the system prompt stays static for prompt-cache friendliness

### Models (`lib/ai.ts`)
- **Default** for every agent: `gemini-3.1-flash-lite-preview` with `thinkingConfig.thinkingLevel = "minimal"`
- This was tuned the hard way: Pro 3.1 + structured output timed out at 60s+, Flash 3 was also slow on planner schemas, Flash Lite 3.1 + minimal thinking lands every prompt in <5s per agent
- The `PRO_MODEL` and `FLASH_25_MODEL` exports are **kept for fallback** but not the default — don't switch back without re-testing the planner schema specifically (its optional `days[]` with nested fields is the latency hot-spot)

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
- TAT enrichment is **lat/lng-validated** — within 50km of the gem's recorded coordinates, otherwise dropped (the keyword search occasionally returns same-named places in different provinces; e.g. "เกาะหมาก" exists in both Trat and Phatthalung)

## Don't break (the "burned by this" list)

1. **TAT keyword search is flaky from Node's fetch.** It hits a Cloudflare BKK edge that returns empty data, while `curl` resolves to a healthy SIN edge. The enrichment scripts (`scripts/*-tat.sh`) deliberately use bash + curl + python for this reason. Don't "modernize" them to Node fetch — you'll get zero matches.
2. **No `startedRef` guard in the Discover page's `useEffect`.** React Strict Mode double-mount aborts the first fetch; a "fetch only once" ref blocks the second mount and the agents stay idle forever. The cancel-via-`AbortController`-in-cleanup pattern is correct as written; don't re-add the ref.
3. **Open-Meteo forecast horizon = 16 days.** When `tripStart > today + 16 days`, the orchestrator skips the Weather Watcher step and emits a "beyond forecast horizon" message. Don't fall back to repeating the last available forecast — that fabricates data and was caught in testing.
4. **Gemini 2.5 doesn't accept `thinkingLevel`.** It returns 400 "Thinking level is not supported for this model." Only Gemini 3.x. The `providerOptions` config in `runners.ts` only sets `thinkingLevel` for runners that route to a 3.x model.
5. **No keys in tracked files.** `.env*` is gitignored. The deploy reads from Railway env vars; the enrichment scripts read from `.env.local`. Don't paste keys into source, comments, commit messages, or docs. Rotate after demo.

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

### A new tourist trap
Append to `data/tourist_traps.json` with `id`, `name_en`, `name_th`, `province`, `why_avoid`, `better_alternatives`. The Crowd Analyst will pick it up automatically when a gem references it via `near_traps`.

## Local development

```bash
cp .env.local.example .env.local      # add at minimum GOOGLE_GENERATIVE_AI_API_KEY
npm install
npm run dev                             # http://localhost:3000 (or 3001 if 3000 taken)
```

For the Web Pulse agent to actually search live, also set `TAVILY_API_KEY` and `EXA_API_KEY`. Without them the agent emits an empty result and the rest of the pipeline still runs.

## Deploy (Railway)

`railway.json` + `nixpacks.toml` are wired. Connect this repo to Railway, set env vars from `.env.local.example`, Railway auto-detects Next.js and runs `npm run build && npm run start`. PORT is injected automatically.
