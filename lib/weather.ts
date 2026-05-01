// Open-Meteo client — free, no API key, fast (~200ms typical).
// We use it to fetch a 14-day daily forecast per base coordinate, then the
// Weather Watcher agent maps those days onto the planner's itinerary days.

<<<<<<< HEAD
=======
import type { DayAirQuality } from "./types";

>>>>>>> 8f57626 (Test)
export interface DailyWeather {
  date: string; // YYYY-MM-DD
  condition: WeatherCondition;
  weather_code: number;
  temp_max_c: number;
  temp_min_c: number;
  precip_mm: number;
  precip_probability: number; // 0-100
  uv_index_max: number;
<<<<<<< HEAD
=======
  air_quality?: DayAirQuality;
>>>>>>> 8f57626 (Test)
}

export type WeatherCondition =
  | "sunny"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "thunderstorm";

// WMO weather code → simple condition bucket.
// Reference: https://open-meteo.com/en/docs (search WMO Weather interpretation codes).
function bucket(code: number): WeatherCondition {
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "partly-cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 95 && code <= 99)) return "rain";
  if (code >= 71 && code <= 86) return "rain"; // we don't get snow in Thailand, but treat as wet
  if (code >= 95) return "thunderstorm";
  return "partly-cloudy";
}

export async function fetchDailyForecast(args: {
  lat: number;
  lng: number;
  days?: number;
  signal?: AbortSignal;
}): Promise<DailyWeather[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(args.lat));
  url.searchParams.set("longitude", String(args.lng));
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "uv_index_max",
    ].join(",")
  );
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", String(Math.min(args.days ?? 14, 16)));

  const res = await fetch(url, { signal: args.signal });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
      precipitation_probability_max?: number[];
      uv_index_max?: number[];
    };
  };
  const d = json.daily;
  if (!d?.time) return [];

  return d.time.map((date, i) => ({
    date,
    weather_code: d.weather_code?.[i] ?? 0,
    condition: bucket(d.weather_code?.[i] ?? 0),
    temp_max_c: Math.round(d.temperature_2m_max?.[i] ?? 0),
    temp_min_c: Math.round(d.temperature_2m_min?.[i] ?? 0),
    precip_mm: d.precipitation_sum?.[i] ?? 0,
    precip_probability: d.precipitation_probability_max?.[i] ?? 0,
    uv_index_max: Math.round(d.uv_index_max?.[i] ?? 0),
  }));
}

/**
 * Fetch forecasts for several bases concurrently with a single shared timeout.
 * Returns a map keyed by base index so the caller can re-associate.
 */
export async function fetchForecastsForBases(
  bases: Array<{ lat: number; lng: number }>,
  days = 14,
  timeoutMs = 5000
): Promise<DailyWeather[][]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await Promise.all(
      bases.map((b) =>
        fetchDailyForecast({
          lat: b.lat,
          lng: b.lng,
          days,
          signal: ac.signal,
        }).catch(() => [] as DailyWeather[])
      )
    );
  } finally {
    clearTimeout(timer);
  }
}
