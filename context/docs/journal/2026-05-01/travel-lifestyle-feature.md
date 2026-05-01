# Travel Lifestyle Feature

**Date:** 2026-05-01
**Status:** Completed

## Summary
Added Travel Lifestyle dropdown to the landing page, allowing users who don't know Thai destinations to select their preferred travel style. The selection flows through the entire agent pipeline, influencing gem selection, curation, and planning.

## Changes

### Backend (5 files)
- `lib/types.ts` — Added `TravelLifestyle` union type (11 values)
- `lib/agents/prompts.ts` — Added `lifestyleContext()` helper function with per-agent lifestyle guidance
- `lib/agents/runners.ts` — Added `lifestyle?: string` param to all 8 runner functions, injecting context into user prompts
- `lib/agents/orchestrator.ts` — Threaded `lifestyle` to all runner calls
- `app/api/orchestrate/route.ts` — Parse + validate `lifestyle` from request body

### Frontend (2 files)
- `app/page.tsx` — Added lifestyle dropdown with 11 options, underline on "Trip starts" label, lifestyle in URL params
- `app/discover/page.tsx` — Read lifestyle from URL params, send in POST body, display lifestyle badge

## Design Decisions
- Lifestyle context goes in **user prompts** (not system prompts) to preserve prompt-cache friendliness
- `DEFAULT` = empty string = original behavior (fully backward compatible)
- No Zod schema changes — lifestyle is a prompt-level signal, not structured output
- Only 5 key agents (listener, webPulse, crowdAnalyst, curator, planner) receive lifestyle-specific guidance; Weather Watcher and Verifier work with factual data

## Lifestyle Options
| Value | Label |
|-------|-------|
| DEFAULT | No preference |
| ADVENTURE | Adventure & Outdoors |
| METROPOLIS | City & Urban |
| WALKING_STREET | Markets & Walking Streets |
| NIGHT_LIFE | Nightlife & Entertainment |
| WELLNESS | Wellness & Spa |
| FOODIE | Food & Street Food |
| CULTURE | Culture & Heritage |
| NATURE | Nature & Wildlife |
| BEACH | Beach & Islands |
| PHOTOGRAPHY | Photography & Scenic |

## Verification
- `npx tsc --noEmit` — passed
- `npx next build` — passed (Compiled successfully)
