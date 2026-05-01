import { generateObject } from "ai";
import { MODELS } from "../ai";
import type { HiddenGem, MapsCrowdSignal, TouristTrap } from "../types";
import {
  realtimeThaiSearch,
  type WebHit,
  type WebSearchResult,
} from "../web-search";
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

function bangkokYear(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}

function buildWebPulseQuery(userPrompt: string, candidates: HiddenGem[]): string {
  const names = candidates
    .slice(0, 6)
    .map((g) => `${g.name_th} ${g.name_en}`)
    .join(" ");
  const provinces = Array.from(new Set(candidates.map((g) => g.province)))
    .slice(0, 4)
    .join(" ");
  return [
    userPrompt,
    names,
    provinces,
    "รีวิวล่าสุด",
    "ที่เที่ยวลับ",
    bangkokYear(),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 480);
}

function scrubUndatedEvidenceLanguage(text: string): string {
  return text
    .replace(/\blive-search evidence confirms\b/gi, "undated live-search evidence suggests")
    .replace(/\bsearch evidence confirms\b/gi, "undated search evidence suggests")
    .replace(/\bevidence confirms\b/gi, "evidence suggests")
    .replace(/\brecent live-search evidence\b/gi, "undated live-search evidence")
    .replace(/\brecent search evidence\b/gi, "undated search evidence")
    .replace(/\brecent evidence\b/gi, "undated evidence")
    .replace(/\brecent visitor feedback\b/gi, "undated live-search visibility")
    .replace(/\bfresh confirmations?\b/gi, "visibility signals")
    .replace(/\bfreshly confirmed\b/gi, "visible in search results");
}

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
  mapsCrowdSignals?: MapsCrowdSignal[];
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
  const mapsSignals = (args.mapsCrowdSignals ?? []).map((signal) => ({
    gem_id: signal.gem_id,
    status: signal.status,
    pressure: signal.pressure,
    pressure_score: signal.pressure_score,
    confidence: signal.confidence,
    reasons: signal.reasons,
    adjustments: signal.adjustments,
    matched_place: signal.matched_place
      ? {
          name: signal.matched_place.name,
          business_status: signal.matched_place.business_status,
          open_now: signal.matched_place.open_now,
          rating: signal.matched_place.rating,
          user_rating_count: signal.matched_place.user_rating_count,
          primary_type: signal.matched_place.primary_type,
          match_distance_km: signal.matched_place.match_distance_km,
        }
      : undefined,
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
${JSON.stringify(trapsView)}

Google Maps crowd radar signals (latest request-time proxy data; not a live crowd count):
${JSON.stringify(mapsSignals)}`,
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
    source_published_at?: string;
    evidence_level?: "search-snippet" | "page-scrape";
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
  const hasOnlyUndatedEvidence =
    validations.length > 0 && validations.every((v) => !v.source_published_at);
  if (!hasOnlyUndatedEvidence) return object;

  return {
    ...object,
    narration: scrubUndatedEvidenceLanguage(object.narration),
    reasoning: scrubUndatedEvidenceLanguage(object.reasoning),
    scored: object.scored.map((score) => ({
      ...score,
      why: scrubUndatedEvidenceLanguage(score.why),
    })),
  };
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
}): Promise<{
  output: WebPulseOutput;
  rawHits: WebHit[];
  query: string;
  search: WebSearchResult;
}> {
  // Build a focused query from the Listener's candidate set and ask providers
  // for current Thai-language visibility around those places.
  const query = buildWebPulseQuery(args.userPrompt, args.dataset);

  // 8s timeout for combined web search — providers occasionally stall.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  let search: WebSearchResult;
  try {
    search = await realtimeThaiSearch({
      query,
      maxResults: 8,
      signal: ac.signal,
    });
  } catch {
    search = {
      query,
      searched_at: new Date().toISOString(),
      freshness_note:
        "Live web search failed before returning diagnostics, so this run relied on the curated dataset.",
      provider_statuses: [
        {
          provider: "tavily",
          status: "error",
          hit_count: 0,
          message: "Search pipeline failed before provider diagnostics.",
        },
        {
          provider: "exa",
          status: "error",
          hit_count: 0,
          message: "Search pipeline failed before provider diagnostics.",
        },
        {
          provider: "firecrawl",
          status: "skipped",
          enhanced_count: 0,
          message: "No search hits to scrape.",
        },
      ],
      source_counts: {},
      hits: [],
    };
  } finally {
    clearTimeout(timer);
  }
  const rawHits = search.hits;

  // If no live data, return a graceful empty result so the rest of the pipeline runs.
  if (rawHits.length === 0) {
    return {
      output: {
        narration:
          "The live web search returned no usable Thai-source hits for these candidates — I am falling back to the curated dataset and showing that clearly.",
        validations: [],
        reasoning: search.freshness_note,
      },
      rawHits: [],
      query,
      search,
    };
  }

  const slim = args.dataset.map((g) => ({
    id: g.id,
    name_en: g.name_en,
    name_th: g.name_th,
    province: g.province,
  }));

  try {
    const { object } = await generateObject({
      model: MODELS.curator, // same Flash Lite, fine for this
      schema: webPulseOutputSchema,
      system: WEB_PULSE_PROMPT,
      providerOptions: fastThinking,
      prompt: `User prompt:
"""
${args.userPrompt}
"""

Current live-search timestamp:
${search.searched_at}

Candidate set from the Local Listener (id + names only):
${JSON.stringify(slim)}

Live search diagnostics:
${JSON.stringify({
  freshness_note: search.freshness_note,
  provider_statuses: search.provider_statuses,
  source_counts: search.source_counts,
})}

Live search hits (Thai travel sources; snippets may include Firecrawl page content):
${JSON.stringify(
  rawHits.map((h) => ({
    title: h.title,
    url: h.url,
    snippet: h.snippet,
    source: h.source,
    published_at: h.published_at,
    scraped_at: h.scraped_at,
    evidence_level: h.evidence_level,
  }))
)}`,
    });

    const datedHitCount = rawHits.filter((h) => h.published_at).length;
    const output =
      datedHitCount === 0
        ? {
            ...object,
            narration: `I found ${rawHits.length} live-search hits for ${object.validations.length} candidate matches, but none carried publish dates, so I am treating them as visibility signals, not fresh confirmations.`,
            reasoning: `${object.reasoning} None of the usable hits included a published_at value, so I did not treat them as dated recent evidence.`,
          }
        : object;

    return { output, rawHits, query, search };
  } catch (err) {
    return {
      output: {
        narration:
          "I found live web hits, but the validation model could not safely map them to our candidates — I am keeping the live sources visible without using them to overrule the route.",
        validations: [],
        reasoning:
          err instanceof Error
            ? `Web Pulse validation failed: ${err.message}`
            : "Web Pulse validation failed.",
      },
      rawHits,
      query,
      search,
    };
  }
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
