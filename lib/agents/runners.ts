import { generateObject } from "ai";
import { MODELS } from "../ai";
import type {
  DestinationSuggestion,
  HiddenGem,
  MapsCrowdSignal,
  TouristTrap,
  WellnessVenue,
} from "../types";
import {
  luxuryWellnessSearch,
  realtimeThaiSearch,
  type WebHit,
  type WebSearchResult,
} from "../web-search";
import type { DailyWeather } from "../weather";
import {
  CROWD_ANALYST_PROMPT,
  CURATOR_PROMPT,
  DESTINATION_SCOUT_PROMPT,
  LISTENER_PROMPT,
  PLANNER_PROMPT,
  VERIFIER_PROMPT,
  WEATHER_WATCHER_PROMPT,
  WEB_PULSE_PROMPT,
  WELLNESS_PULSE_PROMPT,
} from "./prompts";
import {
  crowdAnalystOutputSchema,
  curatorOutputSchema,
  destinationSuggestionOutputSchema,
  listenerOutputSchema,
  plannerOutputSchema,
  verifierOutputSchema,
  weatherWatcherOutputSchema,
  webPulseOutputSchema,
  wellnessPulseOutputSchema,
  type CrowdAnalystOutput,
  type CuratorOutput,
  type DestinationSuggestionOutput,
  type ListenerOutput,
  type PlannerOutput,
  type VerifierOutput,
  type WeatherWatcherOutput,
  type WebPulseOutput,
  type WellnessPulseOutput,
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

const slimDestinationGem = (g: HiddenGem) => ({
  id: g.id,
  name_en: g.name_en,
  province: g.province,
  region: g.region,
  lat: g.lat,
  lng: g.lng,
  category: g.category,
  vibe_tags: g.vibe_tags,
  crowd_level: g.crowd_level,
  auth_score: g.auth_score,
  best_time: g.best_time,
  vegan_friendly: g.vegan_friendly ?? false,
  family_friendly: g.family_friendly ?? false,
  one_liner: g.en_description.slice(0, 150),
});

const REGION_LABELS: Record<HiddenGem["region"], string> = {
  north: "Northern Thailand",
  northeast: "Northeast Thailand",
  central: "Central Thailand",
  east: "Eastern coast",
  south: "Southern Thailand",
  west: "Western forests",
};

const CATEGORY_LABELS: Record<HiddenGem["category"], string> = {
  nature: "nature",
  temple: "temple culture",
  food: "food trails",
  culture: "local culture",
  adventure: "soft adventure",
  beach: "quiet coast",
  village: "village slow travel",
};

const STYLE_HINTS: Array<{
  tag: string;
  words: string[];
  categories?: HiddenGem["category"][];
  vibes?: string[];
}> = [
  {
    tag: "quiet",
    words: ["quiet", "peaceful", "calm", "slow", "uncrowded", "crowd", "crowds", "tourist traps"],
    vibes: ["quiet", "peaceful", "low-carbon", "slow-life"],
  },
  {
    tag: "nature",
    words: ["nature", "forest", "jungle", "mountain", "hike", "wildlife", "waterfall"],
    categories: ["nature", "adventure"],
    vibes: ["jungle", "forest", "wildlife", "misty-mornings"],
  },
  {
    tag: "beach",
    words: ["beach", "island", "sea", "snorkel", "water", "sunset", "coast"],
    categories: ["beach"],
    vibes: ["no-jet-skis", "low-carbon"],
  },
  {
    tag: "food",
    words: ["food", "seafood", "market", "coffee", "eat", "restaurant"],
    categories: ["food"],
    vibes: ["market", "seafood", "coffee"],
  },
  {
    tag: "culture",
    words: ["culture", "heritage", "history", "local", "village", "craft"],
    categories: ["culture", "village"],
    vibes: ["heritage", "craft", "mon-culture"],
  },
  {
    tag: "temples",
    words: ["temple", "temples", "buddhist", "monk", "spiritual"],
    categories: ["temple"],
    vibes: ["temple", "heritage"],
  },
  {
    tag: "wellness",
    words: ["wellness", "spa", "relax", "reset", "massage", "onsen", "yoga"],
    vibes: ["peaceful", "slow-life"],
  },
  {
    tag: "family",
    words: ["family", "kids", "children"],
  },
  {
    tag: "vegetarian",
    words: ["vegetarian", "vegan", "plant-based", "jay"],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function styleMatches(stylePrompt: string): typeof STYLE_HINTS {
  const lower = stylePrompt.toLowerCase();
  return STYLE_HINTS.filter((hint) =>
    hint.words.some((word) => lower.includes(word))
  );
}

function scoreGemForStyle(gem: HiddenGem, stylePrompt: string): number {
  const lower = stylePrompt.toLowerCase();
  const matches = styleMatches(stylePrompt);
  let score = gem.auth_score * 2 + (6 - gem.crowd_level) * 1.7;

  for (const hint of matches) {
    if (hint.categories?.includes(gem.category)) score += 7;
    if (hint.vibes?.some((vibe) => gem.vibe_tags.includes(vibe))) score += 3;
  }

  for (const tag of gem.vibe_tags) {
    const words = tag.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (words.some((word) => word.length > 3 && lower.includes(word))) {
      score += 2;
    }
  }

  if ((lower.includes("vegan") || lower.includes("vegetarian")) && gem.vegan_friendly) {
    score += 4;
  }
  if ((lower.includes("family") || lower.includes("kids")) && gem.family_friendly) {
    score += 4;
  }
  if ((lower.includes("hate crowds") || lower.includes("no crowds")) && gem.crowd_level <= 2) {
    score += 4;
  }

  return score;
}

function dominantCategory(gems: HiddenGem[]): HiddenGem["category"] {
  const counts = new Map<HiddenGem["category"], number>();
  for (const gem of gems) {
    counts.set(gem.category, (counts.get(gem.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "culture";
}

function extractStyleTags(stylePrompt: string, anchors: HiddenGem[]): string[] {
  const matched = styleMatches(stylePrompt).map((hint) => hint.tag);
  const vibeTags = anchors.flatMap((gem) => gem.vibe_tags).slice(0, 8);
  return unique([...matched, ...vibeTags])
    .map((tag) => tag.replace(/-/g, " "))
    .slice(0, 6);
}

function composeDestinationPrompt(args: {
  stylePrompt: string;
  title: string;
  provinces: string[];
  anchors: HiddenGem[];
  startDate?: string;
}): string {
  const startLine = args.startDate ? `Trip starts on ${args.startDate}. ` : "";
  const anchorLine = args.anchors
    .map((gem) => `${gem.name_en} (${gem.province})`)
    .join("; ");
  return [
    `Travel style: ${args.stylePrompt.trim()}.`,
    startLine,
    `Focus on the ${args.title} trip cluster in ${args.provinces.join(", ")}.`,
    `Anchor ideas: ${anchorLine}.`,
    "Build a slow, less-crowded itinerary around this cluster and avoid famous tourist traps.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionFromAnchors(args: {
  stylePrompt: string;
  anchors: HiddenGem[];
  startDate?: string;
  idSuffix?: string;
}): DestinationSuggestion | null {
  const anchors = args.anchors.slice(0, 4);
  if (anchors.length < 2) return null;

  const provinces = unique(anchors.map((gem) => gem.province)).slice(0, 3);
  const region = anchors[0].region;
  const category = dominantCategory(anchors);
  const titleBase = `${provinces.slice(0, 2).join(" + ")} ${CATEGORY_LABELS[category]}`;
  const title = titleBase.replace(/\s+/g, " ").trim();
  const avgCrowd =
    anchors.reduce((sum, gem) => sum + gem.crowd_level, 0) / anchors.length;
  const styleTags = extractStyleTags(args.stylePrompt, anchors);
  const firstNames = anchors.slice(0, 2).map((gem) => gem.name_en).join(" + ");
  const id = slugify(`${region}-${category}-${provinces.join("-")}-${args.idSuffix ?? ""}`);

  return {
    id,
    title,
    subtitle: `${REGION_LABELS[region]} cluster anchored by ${firstNames}.`,
    provinces,
    region,
    anchor_gem_ids: anchors.map((gem) => gem.id),
    style_tags: styleTags.length >= 2 ? styleTags : [CATEGORY_LABELS[category], "low crowd"],
    why: `It matches ${styleTags.slice(0, 3).join(", ") || CATEGORY_LABELS[category]} while keeping the route compact and local.`,
    avoidance_note:
      avgCrowd <= 2.5
        ? "Built around low-crowd anchors instead of the famous checklist route."
        : "Keeps the main bases outside Thailand's highest-pressure tourist bottlenecks.",
    composed_prompt: composeDestinationPrompt({
      stylePrompt: args.stylePrompt,
      title,
      provinces,
      anchors,
      startDate: args.startDate,
    }),
  };
}

export function buildFallbackDestinationSuggestions(args: {
  dataset: HiddenGem[];
  stylePrompt: string;
  startDate?: string;
  count?: number;
  excludeSuggestionIds?: string[];
}): DestinationSuggestion[] {
  const target = args.count ?? 3;
  const scored = args.dataset
    .map((gem) => ({ gem, score: scoreGemForStyle(gem, args.stylePrompt) }))
    .sort((a, b) => b.score - a.score);
  const usedSuggestionIds = new Set(args.excludeSuggestionIds ?? []);
  const usedPrimaryProvinces = new Set<string>();
  const suggestions: DestinationSuggestion[] = [];

  for (const { gem: seed } of scored) {
    if (suggestions.length >= target) break;
    if (usedPrimaryProvinces.has(seed.province)) continue;

    const nearby = scored
      .filter(({ gem }) => gem.id !== seed.id && gem.region === seed.region)
      .map(({ gem, score }) => ({
        gem,
        score: score - Math.min(haversineKm(seed, gem) / 80, 4),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ gem }) => gem);

    const anchors = [seed];
    for (const gem of nearby) {
      const nextProvinceCount = unique([...anchors.map((a) => a.province), gem.province]).length;
      if (nextProvinceCount > 3) continue;
      anchors.push(gem);
      if (anchors.length >= 4) break;
    }

    const suggestion = buildSuggestionFromAnchors({
      stylePrompt: args.stylePrompt,
      anchors,
      startDate: args.startDate,
      idSuffix: String(suggestions.length + 1),
    });
    if (!suggestion || usedSuggestionIds.has(suggestion.id)) continue;

    suggestions.push(suggestion);
    usedSuggestionIds.add(suggestion.id);
    usedPrimaryProvinces.add(seed.province);
  }

  return suggestions;
}

export function normalizeDestinationSuggestions(args: {
  output: DestinationSuggestionOutput | null;
  dataset: HiddenGem[];
  stylePrompt: string;
  startDate?: string;
}): DestinationSuggestion[] {
  const byId = new Map(args.dataset.map((gem) => [gem.id, gem]));
  const seenSuggestionIds = new Set<string>();
  const seenAnchorKeys = new Set<string>();
  const normalized: DestinationSuggestion[] = [];

  for (const suggestion of args.output?.suggestions ?? []) {
    const anchors = unique(suggestion.anchor_gem_ids)
      .map((id) => byId.get(id))
      .filter((gem): gem is HiddenGem => !!gem)
      .slice(0, 4);
    if (anchors.length < 2) continue;

    const anchorKey = anchors
      .map((gem) => gem.id)
      .sort()
      .join("|");
    if (seenAnchorKeys.has(anchorKey)) continue;

    const anchorProvinces = anchors.map((gem) => gem.province);
    const provinces = unique([
      ...anchorProvinces,
      ...suggestion.provinces.map((p) => p.trim()).filter(Boolean),
    ]).slice(0, 3);
    const region = anchors.some((gem) => gem.region === suggestion.region)
      ? suggestion.region
      : anchors[0].region;
    const title =
      suggestion.title.trim() ||
      `${provinces.slice(0, 2).join(" + ")} ${CATEGORY_LABELS[dominantCategory(anchors)]}`;
    const baseId = slugify(suggestion.id || title) || `destination-${normalized.length + 1}`;
    let id = baseId;
    let suffix = 2;
    while (seenSuggestionIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    const aiStyleTags = suggestion.style_tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 6);

    normalized.push({
      id,
      title,
      subtitle:
        suggestion.subtitle.trim() ||
        `${REGION_LABELS[region]} cluster anchored by ${anchors[0].name_en}.`,
      provinces,
      region,
      anchor_gem_ids: anchors.map((gem) => gem.id),
      style_tags:
        aiStyleTags.length >= 2
          ? aiStyleTags
          : extractStyleTags(args.stylePrompt, anchors),
      why:
        suggestion.why.trim() ||
        `It matches your style while keeping the route compact around ${provinces.join(", ")}.`,
      avoidance_note:
        suggestion.avoidance_note.trim() ||
        "Built around lower-crowd anchors instead of the famous checklist route.",
      composed_prompt:
        suggestion.composed_prompt.trim() ||
        composeDestinationPrompt({
          stylePrompt: args.stylePrompt,
          title,
          provinces,
          anchors,
          startDate: args.startDate,
        }),
    });
    seenSuggestionIds.add(id);
    seenAnchorKeys.add(anchorKey);
  }

  return normalized.slice(0, 5);
}

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

export async function runDestinationScout(args: {
  stylePrompt: string;
  startDate?: string;
  dataset: HiddenGem[];
}): Promise<DestinationSuggestionOutput> {
  const slim = args.dataset.map(slimDestinationGem);
  const dateLine = args.startDate
    ? `Trip start date: ${args.startDate}`
    : "Trip start date: not specified";

  const { object } = await generateObject({
    model: MODELS.destinationScout,
    schema: destinationSuggestionOutputSchema,
    system: DESTINATION_SCOUT_PROMPT,
    providerOptions: fastThinking,
    prompt: `User style prompt:
"""
${args.stylePrompt}
"""

${dateLine}

Curated Hidden Siam gems (${slim.length} entries):
${JSON.stringify(slim)}

Return 3-5 trip clusters. Each must include 2-4 anchor_gem_ids from the dataset and a composed_prompt for the existing itinerary flow.`,
  });
  return object;
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

const slimWellness = (
  v: WellnessVenue,
  nearestKm?: number,
  nearestProvince?: string
) => ({
  id: v.id,
  name_en: v.name_en,
  province: v.province,
  region: v.region,
  wellness_type: v.wellness_type,
  thai_authenticity: v.thai_authenticity,
  sha_tier: v.sha_tier,
  awards: v.awards.map((a) => `${a.source}${a.rank ? ` (${a.rank})` : ""}`),
  signature_treatments: v.signature_treatments.slice(0, 4),
  local_character: v.local_character,
  price_tier: v.price_tier,
  km_from_trip:
    typeof nearestKm === "number" ? Number(nearestKm.toFixed(0)) : undefined,
  nearest_trip_province: nearestProvince,
});

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function runWellnessPulse(args: {
  userPrompt: string;
  dataset: WellnessVenue[];
  tripProvinces: string[];
  candidateGems: Array<{ province: string; lat: number; lng: number }>;
  proximityRadiusKm?: number;
}): Promise<{
  output: WellnessPulseOutput;
  liveBoost: {
    hits: WebHit[];
    status: "ok" | "missing-key" | "timeout" | "error";
    message?: string;
    searched_at: string;
    query: string;
  } | null;
}> {
  // Geographic pre-filter — keep wellness venues within `radius` km of ANY
  // listener candidate gem. This stops the model from choosing a venue in a
  // neighbouring province that's actually 130 km from the trip's bases (e.g.
  // a Mae Hong Son monastery for a Chiang Mai trip). Falls back to the full
  // dataset only if the radius removes everything (safety net).
  const radiusKm = args.proximityRadiusKm ?? 80;
  const annotated = args.dataset
    .map((v) => {
      let nearestKm = Infinity;
      let nearestProvince = "";
      for (const g of args.candidateGems) {
        const km = haversineKm(
          { lat: v.lat, lng: v.lng },
          { lat: g.lat, lng: g.lng }
        );
        if (km < nearestKm) {
          nearestKm = km;
          nearestProvince = g.province;
        }
      }
      return { v, nearestKm, nearestProvince };
    })
    .sort((a, b) => a.nearestKm - b.nearestKm);

  const withinRadius = annotated.filter((a) => a.nearestKm <= radiusKm);
  const usable = withinRadius.length > 0 ? withinRadius : annotated.slice(0, 6);
  const slim = usable.map(({ v, nearestKm, nearestProvince }) =>
    slimWellness(v, nearestKm, nearestProvince)
  );

  // If geographic filter wiped everything, the dataset is just too sparse for
  // this trip (e.g. Isaan with no curated wellness venues yet). Skip cleanly.
  if (slim.length === 0) {
    return {
      output: {
        narration:
          "I checked our curated Thai wellness dataset, but none of the venues are within easy reach of your trip — I am leaving the wellness panel empty rather than suggesting venues you'd have to fly to.",
        picks: [],
        reasoning:
          "Geographic pre-filter dropped every curated venue beyond 80km from the listener's candidate gems.",
      },
      liveBoost: null,
    };
  }

  // Run a non-blocking luxury web search in parallel with the model call.
  // The model doesn't see these results — they exist purely to enrich the UI
  // and prove our cross-validation across the four data layers.
  const liveQuery = [
    "luxury Thai wellness",
    args.tripProvinces.slice(0, 3).join(" "),
    "spa retreat onsen",
    bangkokYear(),
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 240);

  const liveBoostPromise = luxuryWellnessSearch({
    query: liveQuery,
    maxResults: 5,
  }).then((res) => ({ ...res, query: liveQuery }));

  const modelPromise = generateObject({
    model: MODELS.curator,
    schema: wellnessPulseOutputSchema,
    system: WELLNESS_PULSE_PROMPT,
    providerOptions: fastThinking,
    prompt: `User prompt:
"""
${args.userPrompt}
"""

Trip provinces (from the Listener's candidate gems):
${JSON.stringify(args.tripProvinces)}

Curated Thai wellness venues (${slim.length} entries — pick 0-5 by id):
${JSON.stringify(slim)}

Pick the 0-5 venues whose Thai character + signature treatments + awards best match the user's prompt and trip provinces. Empty array is a valid answer if no venue fits.`,
  });

  let output: WellnessPulseOutput;
  try {
    const { object } = await modelPromise;
    const validIds = new Set(args.dataset.map((v) => v.id));
    output = {
      ...object,
      picks: object.picks.filter((p) => validIds.has(p.id)).slice(0, 5),
    };
  } catch (err) {
    output = {
      narration:
        "I could not score the wellness picks safely this run, so I am leaving the wellness panel empty rather than guessing.",
      picks: [],
      reasoning:
        err instanceof Error
          ? `Wellness Pulse model failed: ${err.message}`
          : "Wellness Pulse model failed.",
    };
  }

  const liveBoost = await liveBoostPromise;
  return { output, liveBoost };
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
