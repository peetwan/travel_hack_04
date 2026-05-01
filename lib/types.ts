export type GemCategory =
  | "nature"
  | "temple"
  | "food"
  | "culture"
  | "adventure"
  | "beach"
  | "village";

export interface TatEnrichment {
  place_id: string;
  slug: string;
  name_th: string;
  thumbnail_url: string | null;
  sha_certified: boolean;
  province_th: string;
  detail_url: string | null;
  distance_km: number;
}

export interface HiddenGem {
  id: string;
  name_th: string;
  name_en: string;
  province: string;
  region: "north" | "northeast" | "central" | "east" | "south" | "west";
  lat: number;
  lng: number;
  category: GemCategory;
  vibe_tags: string[];
  crowd_level: 1 | 2 | 3 | 4 | 5;
  auth_score: 1 | 2 | 3 | 4 | 5;
  best_time: string;
  thai_description: string;
  en_description: string;
  source_urls: string[];
  near_traps: string[];
  vegan_friendly?: boolean;
  family_friendly?: boolean;
  accessibility?: string;
  tat?: TatEnrichment;
}

export interface DestinationSuggestion {
  id: string;
  title: string;
  subtitle: string;
  provinces: string[];
  region: HiddenGem["region"];
  anchor_gem_ids: string[];
  style_tags: string[];
  why: string;
  avoidance_note: string;
  composed_prompt: string;
}

export interface TouristTrap {
  id: string;
  name_en: string;
  name_th: string;
  province: string;
  why_avoid: string;
  better_alternatives: string[];
}

export type AgentName =
  | "orchestrator"
  | "listener"
  | "web-pulse"
  | "wellness-pulse"
  | "crowd-analyst"
  | "curator"
  | "planner"
  | "weather-watcher"
  | "verifier";

export type WellnessType =
  | "spa"
  | "wellness-resort"
  | "thai-massage-school"
  | "herbal-sauna"
  | "onsen"
  | "yoga-retreat"
  | "meditation-retreat"
  | "muay-thai-camp"
  | "traditional-medicine";

export type WellnessPriceTier = "$" | "$$" | "$$$" | "$$$$";

export type WellnessAwardSource =
  | "forbes-travel-guide"
  | "conde-nast"
  | "travel-leisure"
  | "world-spa-awards"
  | "michelin-keys"
  | "tatler"
  | "tat-sha";

export interface WellnessAward {
  source: WellnessAwardSource;
  year: number;
  rank?: string;
}

export type ShaTier = "SHA" | "SHA Plus" | "SHA Extra Plus";

export interface WellnessVenue {
  id: string;
  name_th: string;
  name_en: string;
  province: string;
  region: "north" | "northeast" | "central" | "east" | "south" | "west";
  lat: number;
  lng: number;
  wellness_type: WellnessType;
  signature_treatments: string[];
  price_tier: WellnessPriceTier;
  thai_authenticity: 1 | 2 | 3 | 4 | 5;
  crowd_level: 1 | 2 | 3 | 4 | 5;
  sha_certified: boolean;
  sha_tier?: ShaTier;
  awards: WellnessAward[];
  languages: string[];
  local_character: string;
  en_description: string;
  th_description: string;
  booking_url?: string;
  source_urls: string[];
  google_rating?: number;
  google_review_count?: number;
  google_maps_uri?: string;
  google_photo_url?: string;
  business_status?: string;
  match_distance_km?: number;
  why?: string;
  tat?: TatEnrichment;
}

export interface WellnessPulsePick {
  id: string;
  why: string;
  luxury_signals: string[];
}

export interface WellnessPulseDiagnostics {
  candidate_count: number;
  picked_count: number;
  validated_count: number;
  search_status: "ok" | "missing-key" | "skipped" | "timeout" | "error";
  search_message?: string;
  search_query?: string;
  searched_at?: string;
}

export type WeatherCondition =
  | "sunny"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "thunderstorm";

export interface DayWeather {
  date: string; // YYYY-MM-DD
  condition: WeatherCondition;
  weather_code: number;
  temp_max_c: number;
  temp_min_c: number;
  precip_probability: number;
  precip_mm: number;
  uv_index_max: number;
  advice?: string;
}

export type WebEvidenceProvider = "tavily" | "exa" | "firecrawl";

export type WebEvidenceProviderStatus =
  | "ok"
  | "missing-key"
  | "timeout"
  | "error"
  | "skipped";

export interface WebEvidenceProviderReport {
  provider: WebEvidenceProvider;
  status: WebEvidenceProviderStatus;
  hit_count?: number;
  enhanced_count?: number;
  message?: string;
}

export interface WebEvidence {
  query: string;
  searched_at: string;
  freshness_note: string;
  source_counts: Partial<Record<WebEvidenceProvider, number>>;
  provider_statuses: WebEvidenceProviderReport[];
  hits: Array<{
    title: string;
    url: string;
    snippet: string;
    source: "tavily" | "exa" | "firecrawl";
    published_at?: string;
    scraped_at?: string;
    evidence_level?: "search-snippet" | "page-scrape";
  }>;
  validations: Array<{
    gem_id: string;
    verdict: "supports" | "contradicts" | "neutral";
    quote: string;
    source_url: string;
    source_published_at?: string;
    evidence_level?: "search-snippet" | "page-scrape";
  }>;
  discovered_gems?: DiscoveredGem[];
}

export interface DiscoveredGem {
  id: string;
  name_en: string;
  name_th?: string;
  province: string;
  why: string;
  source_url: string;
  source_published_at?: string;
  lat?: number;
  lng?: number;
  google_maps_uri?: string;
  google_review_count?: number;
  google_rating?: number;
  match_distance_km?: number;
}

export type CrowdPressure = "low" | "medium" | "high" | "unknown";

export type CrowdSignalSource = "google-maps" | "trip-calendar" | "web-pulse";

export interface CrowdSignalAdjustment {
  source: CrowdSignalSource;
  pressure: CrowdPressure;
  weight: number;
  reason: string;
}

export type MapsCrowdSignalStatus =
  | "ok"
  | "missing-key"
  | "no-match"
  | "timeout"
  | "error";

export interface MapsCrowdSignal {
  gem_id: string;
  checked_at: string;
  status: MapsCrowdSignalStatus;
  pressure: CrowdPressure;
  pressure_score?: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  adjustments?: CrowdSignalAdjustment[];
  matched_place?: {
    id: string;
    name: string;
    business_status?: string;
    open_now?: boolean;
    rating?: number;
    user_rating_count?: number;
    primary_type?: string;
    types?: string[];
    google_maps_uri?: string;
    match_distance_km?: number;
    /** Google Places `places/.../photos/...` resource path. Resolve to a public
     * lh3.googleusercontent.com URL via the Photos API before sending to the UI
     * (otherwise the API key would have to be exposed). */
    photo_name?: string;
    /** Resolved public photo URL (no API key) — set lazily for selected gems
     * only, since each lookup costs one extra Google Places API call. */
    google_photo_url?: string;
  };
  message?: string;
}

export interface MapsCrowdReport {
  provider: "google-maps";
  checked_at: string;
  status: MapsCrowdSignalStatus;
  signal_count: number;
  message?: string;
  signals: MapsCrowdSignal[];
}

export type AgentStatus = "idle" | "thinking" | "done" | "error";

export interface AgentEvent {
  type:
    | "agent_start"
    | "agent_thinking"
    | "agent_progress"
    | "agent_complete"
    | "agent_error"
    | "final_result"
    | "error"
    | "done";
  agent?: AgentName;
  message?: string;
  data?: unknown;
  timestamp: number;
}

/** A morning or afternoon activity block. `place` is the most distinctive
 * named location for that block; `gem_id` is set when `place` is one of the
 * day's selected gems so the UI can link the place name to the gem's
 * Google Maps URI. */
export interface DayActivity {
  place: string;
  activity: string;
  gem_id?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  stay_at: string;
  is_transfer_day: boolean;
  morning?: DayActivity;
  afternoon?: DayActivity;
  /** Concrete restaurant pick for the evening — name + one short reason
   * (signature dish, local heritage, what makes it the local favourite). */
  evening_dinner?: { name: string; why: string };
  gems: string[];
  weather?: DayWeather;
  date?: string;
  holiday?: ThaiHolidayHit;
}

export interface ItineraryStay {
  gem_id: string;
  nights: number;
  why_this_base: string;
}

export interface ThaiHolidayHit {
  date: string;
  name_en: string;
  name_th: string;
  impact: "national-holiday" | "cultural-festival";
  crowd_impact: "high" | "medium" | "low";
  notes?: string;
  /** Index into FinalItinerary.days[] this holiday lands on, if any. */
  day?: number;
}

export interface FinalItinerary {
  summary: string;
  reasoning: string;
  selected_gems: HiddenGem[];
  avoided_traps: string[];
  stays: ItineraryStay[];
  days?: ItineraryDay[];
  tips: string[];
  web_evidence?: WebEvidence;
  weather?: {
    forecast_window: { start: string; end: string };
    best_day_for_outdoor: number | null;
    note: string;
  };
  trip_dates?: { start: string; end: string };
  holidays?: ThaiHolidayHit[];
  crowd_radar?: MapsCrowdReport;
  discovered_gems?: DiscoveredGem[];
  wellness_finds?: WellnessVenue[];
  wellness_diagnostics?: WellnessPulseDiagnostics;
}

export interface UserQuery {
  prompt: string;
  duration_days?: number;
  region_hint?: string;
  preferences?: string[];
}
