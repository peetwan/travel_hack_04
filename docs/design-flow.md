# Hidden Siam Design Flow

This document is the source of truth for the customer journey and system flow from the first prompt to the final itinerary.

## 1. Product Intent

Hidden Siam is designed for foreign travelers who may know almost nothing about Thailand. The product should not assume they can name a province, island, mountain town, or region.

The core UX principle is:

> Ask for travel style first, help the user choose a destination second, then run the full agent crew.

This prevents the common failure mode of travel assistants: asking the user to provide geography they do not understand yet, then producing a generic route around famous places.

## 2. Current Journey

```
Home (/)
  User enters style prompt + start date
  Example: "Peaceful beaches, no party scene, good seafood, 5 days."
    ↓
Destinations (/destinations?style=...&start=...)
  Destination Scout loads 3-5 trip clusters
  User chooses one clean card
    ↓
Discover (/discover?q=...&start=...&destinationTitle=...)
  Existing SSE itinerary crew runs
  Final route, map, days, live finds, wellness picks, warnings, and tips render
```

The Destination Scout is intentionally separate from the live agent panel. The user sees it as a polished destination-selection page, not as another streamed agent row.

## 3. Route Responsibilities

### `/`

Purpose: capture intent with as little friction as possible.

Customer-facing UI:
- Brand header
- Compact hero
- Style prompt textarea
- Trip start date
- Primary CTA: `Scout destinations`
- Starter prompts

Design behavior:
- On mobile, the compact hero and prompt box should occupy the first viewport and sit visually around the center to lower-middle of the screen.
- Starter prompts should sit below the primary composition area so they do not make the first screen feel busy.
- The hero should be smaller than a marketing landing page; this is a usable tool, not a campaign page.

Submit behavior:
- Build `URLSearchParams({ style })`
- Add `start` if present
- Navigate to `/destinations`

No AI call happens on the homepage. This keeps the first screen instant and lets browser back work naturally for reprompting.

### `/destinations`

Purpose: help the user pick a Thailand trip cluster without exposing implementation details.

Input:
- `style` query param from homepage
- optional `start` query param

Customer-facing UI:
- Back control: `Edit prompt`
- Small page label: `Choose destination`
- User style prompt shown as confirmation
- Optional trip start date chip
- Loading state while suggestions are generated
- Clean destination cards

Destination card content:
- `title`
- `subtitle`
- `region`
- `provinces`
- `why`
- `avoidance_note`
- CTA: `Plan this trip`

Do not show:
- `anchor_gem_ids`
- `style_tags`
- raw model reasoning
- debug candidate counts
- internal labels like `gem_id`

Those fields exist to make the system reliable, not to help a customer choose.

Selection behavior:
- Use the selected suggestion's `composed_prompt`
- Navigate to `/discover`
- Include:
  - `q`: selected `composed_prompt`
  - `start`: original start date if present
  - `destinationTitle`: selected card title for display

Reprompt behavior:
- User clicks `Edit prompt` or browser back
- Browser returns to `/` with the previous typed prompt preserved by normal client-side history where available

### `/discover`

Purpose: run and display the full itinerary generation pipeline.

Input:
- `q`: composed prompt from selected destination
- optional `start`
- optional `destinationTitle`

Customer-facing UI:
- Prompt panel shows the composed prompt
- If `destinationTitle` exists, show it as the chosen destination badge
- Agent crew streams through Server-Sent Events
- Final result renders itinerary hero, map, day timeline, wellness picks, live finds, and footer notes

Important rule:
- The existing orchestrator flow remains unchanged. Destination Scout only improves the prompt that enters the flow.

## 4. Destination Scout System Flow

Endpoint: `POST /api/destination-suggestions`

Request:

```ts
{
  stylePrompt: string;
  startDate?: string;
}
```

Response:

```ts
{
  suggestions: Array<{
    id: string;
    title: string;
    subtitle: string;
    provinces: string[];
    region: "north" | "northeast" | "central" | "east" | "south" | "west";
    anchor_gem_ids: string[];
    style_tags: string[];
    why: string;
    avoidance_note: string;
    composed_prompt: string;
  }>
}
```

Runtime steps:

1. Validate `stylePrompt` length and optional `startDate`.
2. Load `data/hidden_gems.json`.
3. Build a slim destination dataset for the model:
   - id
   - name
   - province
   - region
   - lat/lng
   - category
   - vibe tags
   - crowd level
   - authenticity score
   - best time
   - vegan/family flags
   - short description
4. Run `runDestinationScout()`.
5. Normalize suggestions:
   - keep only anchor ids that exist
   - require 2-4 valid anchors
   - dedupe equivalent anchor sets
   - make province lists align with real anchors
   - keep max 5 suggestions
6. If fewer than 3 valid suggestions remain, call deterministic fallback.
7. Return suggestions to `/destinations`.

The fallback ranks gems by:
- authenticity score
- low crowd level
- style-category match
- style-vibe match
- vegan/family signals when requested
- geographic coherence within the same region

This means the destination picker remains usable even when the model returns invalid ids or sparse output.

## 5. Composed Prompt Contract

The selected destination's `composed_prompt` is the bridge between pre-flow and the existing agent crew.

It should include:
- original user style words
- optional trip start date
- selected cluster title
- selected provinces
- anchor gem names and provinces
- instruction to build a slow, less-crowded itinerary
- instruction to avoid famous tourist traps

Example shape:

```text
Travel style: Peaceful beaches, no party scene, good seafood, 5 days.
Trip starts on 2026-05-08.
Focus on the Trat + Chanthaburi quiet coast trip cluster in Trat, Chanthaburi.
Anchor ideas: Koh Mak (Trat); Chanthaburi Old Town (Chanthaburi).
Build a slow, less-crowded itinerary around this cluster and avoid famous tourist traps.
```

Do not ask `/discover` to understand the original style prompt plus a separate hidden destination object. The composed prompt is the single source of truth for the orchestrator.

## 6. Live Agent Flow After Selection

Once the user chooses a card, the normal pipeline runs:

```
composed prompt + start date
  ↓
orchestrator
  ↓
Local Listener
  ↓
Web Pulse + Maps Crowd Radar + Wellness Pulse
  ↓
Crowd Analyst
  ↓
Cultural Curator
  ↓
Route Planner
  ↓
Weather Watcher + Verifier
  ↓
Final itinerary
```

Important boundaries:
- Web Pulse discoveries can appear as live leads, but do not enter the planned route.
- Wellness Pulse suggestions appear in a sidebar, not folded into the main itinerary.
- Maps crowd signals are proxy signals, not official live crowd counts.
- Weather is skipped when the trip is beyond Open-Meteo's forecast horizon.

## 7. Mobile UX Rules

Homepage:
- Keep the hero compact.
- Keep the prompt box visible in the first viewport.
- Place the prompt area around the center to lower-middle of the mobile screen.
- Keep starter prompts below the main composition area.
- Avoid a large marketing-style hero that forces the textarea below the fold.

Destinations:
- One card per row on mobile.
- No internal chips or debug labels.
- CTA must be full-width and easy to tap.
- Back/reprompt should be obvious.
- Cards can include region/province chips because these orient the user; they should not include raw hidden-gem ids or style tags.

Discover:
- Preserve the existing streamed agent panel.
- Show `destinationTitle` as a chosen destination badge when present.
- The prompt panel can show the composed prompt because it explains what the agents received.

## 8. Copy Rules

Use customer language:
- "Choose destination"
- "Plan this trip"
- "Finding a few good fits"
- "Edit prompt"

Avoid customer-facing implementation language:
- "anchor gem ids"
- "style tags"
- "candidate set"
- "debug"
- "schema"
- "deterministic fallback"

Use "trip cluster" sparingly. It is useful in docs and internal reasoning, but customer UI should usually say destination, region, or trip.

## 9. Failure States

Missing or too-short style prompt:
- `/destinations` shows a simple message and a Back home CTA.

Destination API error:
- show an inline error with Retry.
- keep user on `/destinations`.

Destination API returns empty suggestions:
- API should generally avoid this through fallback.
- If it happens, show an error and Retry.

User chooses a destination:
- disable CTAs while routing.
- show spinner on the selected CTA.

Orchestrator error:
- handled by existing `/discover` error panel.

## 10. Acceptance Checklist

Before shipping changes to this flow:

- Homepage still routes to `/destinations` with `style` and `start`.
- `/destinations` calls `/api/destination-suggestions` exactly once per loaded query in normal production behavior.
- Destination cards do not expose `anchor_gem_ids` or `style_tags`.
- Choosing a card routes to `/discover` with `q`, `start`, and `destinationTitle`.
- `/discover` still streams the existing agent crew.
- `npx tsc --noEmit` passes.
- `npm run build` passes.
- Do not run local preview or screenshots unless the maintainer asks; the maintainer manually verifies UI at `localhost:3001`.
