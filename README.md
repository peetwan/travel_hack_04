# Hidden Siam

> Five specialized AI agents collaborate to find authentic, less-crowded Thai destinations the famous travel bots never recommend.

Built for the **Thailand Tourism Mini Hackathon** (AI Hackathon SS6, May 2026).

## The pitch

Maya Bay was closed for four years because of overtourism. Phi Phi is a parking lot of long-tail boats. Damnoen Saduak is staged for cruise tours. And every general-purpose AI travel assistant — ChatGPT, Gemini, you-name-it — keeps recommending exactly those places.

**Hidden Siam** runs five specialized AI agents over a hand-curated dataset of authentic Thai destinations sourced from local blogs, Pantip, and the Designated Areas for Sustainable Tourism. The agents argue, filter, and route — the user sees their work happen live.

## The agents

| Agent | Model / Source | Role |
| --- | --- | --- |
| 🔍 Local Listener | Gemini 3.1 Flash Lite | Surfaces 8–12 candidates from the curated dataset |
| 🌐 Web Pulse | Tavily + Exa + Gemini 3.1 Flash Lite | Live-searches Thai travel sources (Pantip, readme.me, chillpainai…) to validate candidates against today's web |
| 📊 Crowd Analyst | Gemini 3.1 Flash Lite | Filters by crowd-tolerance, flags tourist traps the user might be heading toward |
| 🎨 Cultural Curator | Gemini 3.1 Flash Lite | Scores each candidate against the user's vibe **plus** Web Pulse's verdicts |
| 🗺️ Route Planner | Gemini 3.1 Flash Lite | Picks a final 2–4 gems, builds a slow-travel plan with 1–2 bases (no rushing between hotels every night) |
| 🌦️ Weather Watcher | Open-Meteo + Gemini 3.1 Flash Lite | Pulls a 14-day forecast for each base, aligns it to your trip days, and suggests swaps when a day looks rainy |
| ✅ Verifier | Gemini 3.1 Flash Lite | Sanity-checks seasonal closures, etiquette, and adds 2–4 local tips |

Listener and Web Pulse run in parallel — the curated dataset is our local moat, the live web is fresh ground-truth. They reconcile through the Curator. After the Planner picks bases, Weather Watcher and Verifier run in parallel before the result is finalised. The Orchestrator routes work between them all and streams progress over Server-Sent Events so the UI shows every step happening live.

## Stack

- **Next.js 16** App Router (Turbopack)
- **Vercel AI SDK 6** + `@ai-sdk/google` for Gemini
- **react-leaflet** + OpenStreetMap (CARTO dark tiles) — no API key needed
- **Tailwind CSS 4** + Framer Motion for the agent animations
- **Zod** for structured agent output

Single curated JSON file (`data/hidden_gems.json`), no database — keeps the deploy footprint trivial.

## Setup

```bash
npm install
cp .env.local.example .env.local      # then add your keys
npm run dev
```

Open http://localhost:3000.

**Required:** Gemini API key from https://aistudio.google.com/ (free tier 1500 req/day — plenty).

**Recommended for full experience:** Tavily (https://tavily.com), Exa (https://exa.ai), Firecrawl (https://firecrawl.dev) — all have generous free tiers. Without these, the app still works but the Web Pulse agent emits an empty result and the Curator scores from the curated dataset alone.

The full crew uses ~6 calls per prompt and finishes in ~15 seconds.

## Demo prompts

```
3 days in Chiang Mai. I love nature, hate crowds, vegan-friendly.
Weekend escape from Bangkok — peaceful, no tourist traps, good food.
An alternative to Phi Phi for a week. Clear water, no jet skis, sunsets.
10 days exploring temples and culture, but not the Bangkok rush.
```

## Deploy (Railway)

This repo includes a `railway.json` plus the standard `next start` script. To deploy:

1. Push to GitHub.
2. New Railway project → "Deploy from GitHub repo".
3. Add env var `GOOGLE_GENERATIVE_AI_API_KEY` in the Railway dashboard.
4. Railway auto-detects Next.js and runs `npm run build && npm run start`.

Alternative: Vercel — same setup, just point at the repo and add the env var.

## Project structure

```
app/
  page.tsx                    Landing + prompt input
  discover/page.tsx           Live agent stream + final itinerary view
  api/orchestrate/route.ts    SSE endpoint that runs the agent crew
lib/
  ai.ts                       Gemini provider + model config
  types.ts                    Shared types (HiddenGem, AgentEvent, WebEvidence, ...)
  web-search.ts               Tavily + Exa + Firecrawl HTTP helpers (used by Web Pulse)
  agents/
    prompts.ts                System prompts for each agent
    schemas.ts                Zod output schemas
    runners.ts                One function per agent
    orchestrator.ts           Composes the run, emits events
components/
  AgentCard.tsx               Per-agent card with status state machine
  GemCard.tsx                 Hidden-gem card on the result panel
  ItineraryMap.tsx            Leaflet map (dynamic, ssr: false)
  ui/*                        Buttons, cards, badges, textarea
data/
  hidden_gems.json            33 curated gems across all 6 regions
  tourist_traps.json          11 well-known traps + better alternatives
```

## Data sources

The seed dataset was hand-curated from:

- **Pantip** — ห้องบลูแพลนเนต and ห้องกล้อง for landscape spots
- **chillpainai.com**, **readme.me**, **paiduaykan.com** — Thai travel blogs
- **DASTA** — Designated Areas for Sustainable Tourism (gov source)
- **TAT Data API** — official Tourism Authority of Thailand catalog (https://tatdataapi.io/), used by `scripts/enrich-tat.sh` to attach official place IDs, SHA certifications, and thumbnails. After enrichment, every TAT-matched gem is double-checked: the TAT lat/lng must be within 50km of our recorded coordinates, otherwise the match is dropped (the keyword search occasionally returns a same-named place in a different province).

Every entry has real lat/lng, a Thai source URL, and a `near_traps` list pointing at which famous destination it's a better alternative for. Gems found in TAT carry an extra `tat` field with the official `place_id`, slug, thumbnail, SHA flag, and direct link to the TAT detail page — surfaced in the UI as a "TAT verified" badge.

## Why this design

- **Five agents, not one** — judges in an AI hackathon care about agentic patterns. A single Gemini call would have been simpler but invisible.
- **Curated data, not RAG over the open web** — this is the moat. ChatGPT can't recommend Phu Tok because Wikipedia barely covers it; we can.
- **SSE streaming, not "wait 15s and show result"** — the visible work *is* the demo.
- **Tourist-trap awareness, not just gem retrieval** — the verifier explicitly contrasts every recommendation against what a generic AI would have said. Judges see the diff.

## License

MIT — built for a hackathon, do whatever you like with it.
