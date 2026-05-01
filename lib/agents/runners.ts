import { generateObject } from "ai";
import { MODELS } from "../ai";
import type { HiddenGem, TouristTrap } from "../types";
import { combinedThaiSearch, type WebHit } from "../web-search";
import type { DailyWeather } from "../weather";
import {
  CROWD_ANALYST_PROMPT,
  CURATOR_PROMPT,
  LISTENER_PROMPT,
  PLANNER_PROMPT,
  VERIFIER_PROMPT,
  WEATHER_WATCHER_PROMPT,
  WEB_PULSE_PROMPT,
} from "./prompts";
import {
  crowdAnalystOutputSchema,
  curatorOutputSchema,
  listenerOutputSchema,
  plannerOutputSchema,
  verifierOutputSchema,
  weatherWatcherOutputSchema,
  webPulseOutputSchema,
  type CrowdAnalystOutput,
  type CuratorOutput,
  type ListenerOutput,
  type PlannerOutput,
  type VerifierOutput,
  type WeatherWatcherOutput,
  type WebPulseOutput,
} from "./schemas";

// Gemini 3 thinking levels — keep low so demo latency stays under control.
// Only applied to Gemini 3.x models (Flash Lite). Gemini 2.5 doesn't accept thinkingLevel.
const fastThinking = {
  google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
};

const slimGem = (g: HiddenGem) => ({
  id: g.id,
  name_en: g.name_en,
  province: g.province,
  region: g.region,
  category: g.category,
  vibe_tags: g.vibe_tags,
  crowd_level: g.crowd_level,
  auth_score: g.auth_score,
  best_time: g.best_time,
  vegan_friendly: g.vegan_friendly ?? false,
  family_friendly: g.family_friendly ?? false,
  near_traps: g.near_traps,
  one_liner: g.en_description.slice(0, 140),
});

export async function runListener(args: {
  userPrompt: string;
  dataset: HiddenGem[];
}): Promise<ListenerOutput> {
  const slim = args.dataset.map(slimGem);
  const { object } = await generateObject({
    model: MODELS.listener,
    schema: listenerOutputSchema,
    system: LISTENER_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Curated dataset (${slim.length} entries):
${JSON.stringify(slim)}

Return 8-12 candidate ids relevant to the prompt.`,
  });
  return object;
}

export async function runCrowdAnalyst(args: {
  userPrompt: string;
  candidates: HiddenGem[];
  traps: TouristTrap[];
}): Promise<CrowdAnalystOutput> {
  const candidateView = args.candidates.map((g) => ({
    id: g.id,
    name_en: g.name_en,
    crowd_level: g.crowd_level,
    near_traps: g.near_traps,
  }));
  const trapsView = args.traps.map((t) => ({
    id: t.id,
    name_en: t.name_en,
    why_avoid: t.why_avoid,
  }));

  const { object } = await generateObject({
    model: MODELS.crowdAnalyst,
    schema: crowdAnalystOutputSchema,
    system: CROWD_ANALYST_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Candidates from Listener:
${JSON.stringify(candidateView)}

Known tourist traps:
${JSON.stringify(trapsView)}`,
  });
  return object;
}

export async function runCurator(args: {
  userPrompt: string;
  candidates: HiddenGem[];
  webValidations?: Array<{
    gem_id: string;
    verdict: "supports" | "contradicts" | "neutral";
    quote: string;
    source_url: string;
  }>;
}): Promise<CuratorOutput> {
  const view = args.candidates.map((g) => ({
    id: g.id,
    name_en: g.name_en,
    province: g.province,
    category: g.category,
    vibe_tags: g.vibe_tags,
    auth_score: g.auth_score,
    crowd_level: g.crowd_level,
    vegan_friendly: g.vegan_friendly ?? false,
    family_friendly: g.family_friendly ?? false,
    one_liner: g.en_description.slice(0, 160),
  }));

  const validations = args.webValidations ?? [];

  const { object } = await generateObject({
    model: MODELS.curator,
    schema: curatorOutputSchema,
    system: CURATOR_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Candidates after crowd filtering:
${JSON.stringify(view)}

Live web evidence from the Web Pulse agent (use to nudge scores up/down):
${JSON.stringify(validations)}`,
  });
  return object;
}

export async function runPlanner(args: {
  userPrompt: string;
  scored: { id: string; score: number }[];
  gemsById: Map<string, HiddenGem>;
}): Promise<PlannerOutput> {
  const enriched = args.scored
    .map(({ id, score }) => {
      const g = args.gemsById.get(id);
      if (!g) return null;
      return {
        id,
        score,
        name_en: g.name_en,
        province: g.province,
        region: g.region,
        category: g.category,
        best_time: g.best_time,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const { object } = await generateObject({
    model: MODELS.planner,
    schema: plannerOutputSchema,
    system: PLANNER_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Scored candidates (sorted by curator score desc):
${JSON.stringify(enriched)}`,
  });
  return object;
}

export async function runWebPulse(args: {
  userPrompt: string;
  dataset: HiddenGem[];
}): Promise<{ output: WebPulseOutput; rawHits: WebHit[]; query: string }> {
  // Build a focused query from the user prompt; bias toward freshness.
  const query = `${args.userPrompt} ที่เที่ยว hidden gem 2026`;

  // 8s timeout for combined web search — providers occasionally stall.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  let rawHits: WebHit[] = [];
  try {
    rawHits = await combinedThaiSearch({
      query,
      maxResults: 8,
      signal: ac.signal,
    });
  } catch {
    rawHits = [];
  } finally {
    clearTimeout(timer);
  }

  // If no live data, return a graceful empty result so the rest of the pipeline runs.
  if (rawHits.length === 0) {
    return {
      output: {
        narration:
          "The live web search returned no usable hits for this prompt — falling back to the curated dataset alone.",
        validations: [],
        reasoning: "No Tavily/Exa hits within the timeout window.",
      },
      rawHits: [],
      query,
    };
  }

  const slim = args.dataset.map((g) => ({
    id: g.id,
    name_en: g.name_en,
    name_th: g.name_th,
    province: g.province,
  }));

  const { object } = await generateObject({
    model: MODELS.curator, // same Flash Lite, fine for this
    schema: webPulseOutputSchema,
    system: WEB_PULSE_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Curated dataset (id + names only):
${JSON.stringify(slim)}

Live search hits (Tavily + Exa, scoped to Thai travel sources):
${JSON.stringify(
  rawHits.map((h) => ({
    title: h.title,
    url: h.url,
    snippet: h.snippet,
    source: h.source,
  }))
)}`,
  });

  return { output: object, rawHits, query };
}

export async function runWeatherWatcher(args: {
  userPrompt: string;
  daysWithForecast: Array<{
    day: number;
    title: string;
    stay_at: string;
    morning?: string;
    afternoon?: string;
    evening?: string;
    forecast: DailyWeather;
  }>;
}): Promise<WeatherWatcherOutput> {
  // Compact view — model doesn't need every field, just the salient parts.
  const view = args.daysWithForecast.map((d) => ({
    day: d.day,
    title: d.title,
    base: d.stay_at,
    activities: {
      morning: d.morning ?? "",
      afternoon: d.afternoon ?? "",
      evening: d.evening ?? "",
    },
    forecast: {
      condition: d.forecast.condition,
      temp_max_c: d.forecast.temp_max_c,
      temp_min_c: d.forecast.temp_min_c,
      precip_probability: d.forecast.precip_probability,
      uv_index_max: d.forecast.uv_index_max,
    },
  }));

  const { object } = await generateObject({
    model: MODELS.verifier, // same Flash Lite — cheap and quick
    schema: weatherWatcherOutputSchema,
    system: WEATHER_WATCHER_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Days with aligned forecasts:
${JSON.stringify(view)}`,
  });
  return object;
}

export async function runVerifier(args: {
  userPrompt: string;
  selected: HiddenGem[];
  tripDates?: { start: string; end: string };
  holidays?: Array<{
    date: string;
    name_en: string;
    impact: string;
    crowd_impact: "high" | "medium" | "low";
    notes?: string;
  }>;
}): Promise<VerifierOutput> {
  const view = args.selected.map((g) => ({
    id: g.id,
    name_en: g.name_en,
    province: g.province,
    best_time: g.best_time,
    crowd_level: g.crowd_level,
    one_liner: g.en_description.slice(0, 140),
  }));

  const dateLine = args.tripDates
    ? `Trip dates: ${args.tripDates.start} → ${args.tripDates.end}`
    : "Trip dates: not specified by the user.";
  const holidayLine =
    args.holidays && args.holidays.length > 0
      ? `Thai public holidays / cultural festivals overlapping the trip:\n${JSON.stringify(args.holidays, null, 2)}`
      : "No Thai public holidays or major festivals overlap the trip window.";

  const { object } = await generateObject({
    model: MODELS.verifier,
    schema: verifierOutputSchema,
    system: VERIFIER_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

${dateLine}
${holidayLine}

Final selected gems:
${JSON.stringify(view)}`,
  });
  return object;
}
