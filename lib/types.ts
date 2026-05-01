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
  | "crowd-analyst"
  | "curator"
  | "planner"
  | "weather-watcher"
  | "verifier";

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

export interface WebEvidence {
  query: string;
  hits: Array<{
    title: string;
    url: string;
    snippet: string;
    source: "tavily" | "exa" | "firecrawl";
    published_at?: string;
  }>;
  validations: Array<{
    gem_id: string;
    verdict: "supports" | "contradicts" | "neutral";
    quote: string;
    source_url: string;
  }>;
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

export interface ItineraryDay {
  day: number;
  title: string;
  stay_at: string;
  is_transfer_day: boolean;
  morning?: string;
  afternoon?: string;
  evening?: string;
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
}

export interface UserQuery {
  prompt: string;
  duration_days?: number;
  region_hint?: string;
  preferences?: string[];
}
