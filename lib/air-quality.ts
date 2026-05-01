import type { DayAirQuality } from "./types";

// Open-Meteo Air Quality API is keyless and returns hourly PM forecasts.
// We aggregate each local day so the itinerary can show one clear PM signal.

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function pm25Level(pm2_5: number): DayAirQuality["level"] {
  if (pm2_5 <= 12) return "good";
  if (pm2_5 <= 35.4) return "moderate";
  if (pm2_5 <= 55.4) return "unhealthy-sensitive";
  if (pm2_5 <= 150.4) return "unhealthy";
  if (pm2_5 <= 250.4) return "very-unhealthy";
  return "hazardous";
}

export async function fetchDailyAirQuality(args: {
  lat: number;
  lng: number;
  days?: number;
  signal?: AbortSignal;
}): Promise<DayAirQuality[]> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(args.lat));
  url.searchParams.set("longitude", String(args.lng));
  url.searchParams.set("hourly", ["pm2_5", "pm10", "us_aqi"].join(","));
  url.searchParams.set("timezone", "Asia/Bangkok");
  url.searchParams.set("forecast_days", String(Math.min(args.days ?? 5, 7)));

  const res = await fetch(url, { signal: args.signal });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    hourly?: {
      time?: string[];
      pm2_5?: number[];
      pm10?: number[];
      us_aqi?: number[];
    };
  };
  const h = json.hourly;
  if (!h?.time) return [];

  const byDate = new Map<
    string,
    { pm2_5: number[]; pm10: number[]; us_aqi: number[] }
  >();

  h.time.forEach((timestamp, i) => {
    const date = timestamp.slice(0, 10);
    if (!date) return;
    const bucket = byDate.get(date) ?? { pm2_5: [], pm10: [], us_aqi: [] };
    const pm2_5 = h.pm2_5?.[i];
    const pm10 = h.pm10?.[i];
    const usAqi = h.us_aqi?.[i];
    if (typeof pm2_5 === "number") bucket.pm2_5.push(pm2_5);
    if (typeof pm10 === "number") bucket.pm10.push(pm10);
    if (typeof usAqi === "number") bucket.us_aqi.push(usAqi);
    byDate.set(date, bucket);
  });

  return Array.from(byDate.entries()).map(([date, values]) => {
    const pm2_5Avg = Math.round(average(values.pm2_5));
    const pm2_5Max = Math.round(max(values.pm2_5));
    return {
      date,
      pm2_5_avg: pm2_5Avg,
      pm2_5_max: pm2_5Max,
      pm10_avg: Math.round(average(values.pm10)),
      pm10_max: Math.round(max(values.pm10)),
      us_aqi_max:
        values.us_aqi.length > 0 ? Math.round(max(values.us_aqi)) : undefined,
      level: pm25Level(pm2_5Max),
      source: "open-meteo-air-quality",
    };
  });
}

export async function fetchAirQualityForBases(
  bases: Array<{ lat: number; lng: number }>,
  days = 5,
  timeoutMs = 5000
): Promise<DayAirQuality[][]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await Promise.all(
      bases.map((b) =>
        fetchDailyAirQuality({
          lat: b.lat,
          lng: b.lng,
          days,
          signal: ac.signal,
        }).catch(() => [] as DayAirQuality[])
      )
    );
  } finally {
    clearTimeout(timer);
  }
}
