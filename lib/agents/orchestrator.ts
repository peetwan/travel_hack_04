import gemsData from "../../data/hidden_gems.json";
import trapsData from "../../data/tourist_traps.json";
import type {
  AgentEvent,
  AgentName,
  DayWeather,
  FinalItinerary,
  HiddenGem,
  ItineraryDay,
  MapsCrowdReport,
  TouristTrap,
  WebEvidence,
} from "../types";
import { fetchMapsCrowdSignals } from "../google-maps";
import {
  enrichCrowdReport,
  inferTripDaysFromPrompt,
} from "../crowd-radar";
import { fetchForecastsForBases, type DailyWeather } from "../weather";
import {
  holidaysInRange,
  tripEndDate,
  type ThaiHoliday,
} from "../thai-holidays";
import {
  runCrowdAnalyst,
  runCurator,
  runListener,
  runPlanner,
  runVerifier,
  runWeatherWatcher,
  runWebPulse,
} from "./runners";

const GEMS: HiddenGem[] = gemsData as HiddenGem[];
const TRAPS: TouristTrap[] = trapsData as TouristTrap[];
const GEMS_BY_ID = new Map(GEMS.map((g) => [g.id, g]));
const TRAPS_BY_ID = new Map(TRAPS.map((t) => [t.id, t]));

type Emit = (e: AgentEvent) => void;

const now = () => Date.now();

const startMessages: Record<AgentName, string> = {
  orchestrator: "Routing your request through the agent crew…",
  listener: "Scanning our curated dataset of authentic Thai destinations…",
  "web-pulse":
    "Searching live Thai web (Tavily + Exa, Firecrawl where available) for fresh evidence…",
  "crowd-analyst": "Reading your tolerance for crowds and tourist traps…",
  curator: "Matching every candidate against your vibe + web evidence…",
  planner: "Grouping picks by region and shaping a route…",
  "weather-watcher":
    "Pulling 14-day Open-Meteo forecast for each base and aligning to your days…",
  verifier: "Last-mile sanity check: seasons, hours, etiquette…",
};

function todayISO(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDaysISO(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function normalizeStayNights<T extends { gem_id: string; nights: number }>(
  stays: T[],
  days?: Array<{ day: number; stay_at: string }>
): T[] {
  if (!days || days.length <= 1) return stays;

  // A 3-day itinerary has 2 sleeps. Count the base for every day except the
  // departure day so the UI never shows "3 days / 3 nights" unless the plan
  // explicitly spans four calendar days.
  const nightCounts = new Map<string, number>();
  for (const day of days.slice(0, -1)) {
    nightCounts.set(day.stay_at, (nightCounts.get(day.stay_at) ?? 0) + 1);
  }

  const normalized = stays
    .map((stay) => ({
      ...stay,
      nights: nightCounts.get(stay.gem_id) ?? 0,
    }))
    .filter((stay) => stay.nights > 0);

  return normalized.length > 0 ? normalized : stays;
}

export async function orchestrate(
  userPrompt: string,
  emit: Emit,
  options: { startDate?: string } = {}
) {
  // Resolve trip start. If user picked a date, use it; otherwise default to a
  // week from today so the planner has weather data and the result feels real.
  const today = todayISO();
  const tripStart = options.startDate ?? addDaysISO(today, 7);
  const inferredTripDays = inferTripDaysFromPrompt(userPrompt);
  const inferredTripEnd = tripEndDate(tripStart, inferredTripDays);
  const crowdWindowHolidays = holidaysInRange(tripStart, inferredTripEnd);
  const start = now();
  emit({
    type: "agent_start",
    agent: "orchestrator",
    message: startMessages.orchestrator,
    timestamp: now(),
  });

  // 1. Listener first, then Web Pulse.
  //    Web Pulse used to search broadly in parallel; focusing it on Listener
  //    candidates makes the realtime evidence easier to audit and less noisy.
  emit({
    type: "agent_start",
    agent: "listener",
    message: startMessages.listener,
    timestamp: now(),
  });

  const listener = await runListener({ userPrompt, dataset: GEMS });

  const listenerCandidates = listener.candidate_ids
    .map((id) => GEMS_BY_ID.get(id))
    .filter((g): g is HiddenGem => !!g);
  const crowdRadarTask: Promise<MapsCrowdReport> = fetchMapsCrowdSignals({
    gems: listenerCandidates,
    timeoutMs: 7000,
  });
  emit({
    type: "agent_complete",
    agent: "listener",
    message: listener.narration,
    data: {
      candidate_count: listenerCandidates.length,
      candidate_ids: listenerCandidates.map((g) => g.id),
      reasoning: listener.reasoning,
    },
    timestamp: now(),
  });

  emit({
    type: "agent_start",
    agent: "web-pulse",
    message: `Validating ${listenerCandidates.length} Listener picks against live Thai web sources…`,
    timestamp: now(),
  });
  emit({
    type: "agent_progress",
    agent: "web-pulse",
    message:
      "Checking provider health, Thai travel hits, and page-level evidence where available…",
    data: {
      candidate_ids: listenerCandidates.map((g) => g.id),
    },
    timestamp: now(),
  });

  const webPulseResult = await runWebPulse({
    userPrompt,
    dataset: listenerCandidates.length > 0 ? listenerCandidates : GEMS,
  });

  const hitByUrl = new Map(webPulseResult.rawHits.map((h) => [h.url, h]));
  const webEvidence: WebEvidence = {
    query: webPulseResult.query,
    searched_at: webPulseResult.search.searched_at,
    freshness_note: webPulseResult.search.freshness_note,
    provider_statuses: webPulseResult.search.provider_statuses,
    source_counts: webPulseResult.search.source_counts,
    hits: webPulseResult.rawHits.map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet,
      source: h.source,
      published_at: h.published_at,
      scraped_at: h.scraped_at,
      evidence_level: h.evidence_level,
    })),
    validations: webPulseResult.output.validations
      .filter((v) => GEMS_BY_ID.has(v.gem_id))
      .map((v) => {
        const source = hitByUrl.get(v.source_url);
        return {
          ...v,
          source_published_at: v.source_published_at ?? source?.published_at,
          evidence_level: v.evidence_level ?? source?.evidence_level,
        };
      }),
  };
  emit({
    type: "agent_complete",
    agent: "web-pulse",
    message: webPulseResult.output.narration,
    data: {
      hit_count: webEvidence.hits.length,
      validation_count: webEvidence.validations.length,
      supports: webEvidence.validations.filter((v) => v.verdict === "supports")
        .length,
      contradicts: webEvidence.validations.filter(
        (v) => v.verdict === "contradicts"
      ).length,
      searched_at: webEvidence.searched_at,
      freshness_note: webEvidence.freshness_note,
      source_counts: webEvidence.source_counts,
      provider_statuses: webEvidence.provider_statuses,
      sample_sources: webEvidence.hits.slice(0, 3).map((h) => ({
        title: h.title,
        url: h.url,
        published_at: h.published_at,
        evidence_level: h.evidence_level,
      })),
      reasoning: webPulseResult.output.reasoning,
    },
    timestamp: now(),
  });

  // 2. Crowd analyst — parallel-ready, but depends on listener output
  emit({
    type: "agent_start",
    agent: "crowd-analyst",
    message: startMessages["crowd-analyst"],
    timestamp: now(),
  });
  emit({
    type: "agent_progress",
    agent: "crowd-analyst",
    message:
      "Checking Google Maps request-time popularity and opening-status signals…",
    timestamp: now(),
  });
  const rawCrowdRadar = await crowdRadarTask;
  const crowdRadar = enrichCrowdReport({
    report: rawCrowdRadar,
    gems: listenerCandidates,
    tripStart,
    tripDays: inferredTripDays,
    holidays: crowdWindowHolidays,
    webEvidence,
  });
  const crowd = await runCrowdAnalyst({
    userPrompt,
    candidates: listenerCandidates,
    traps: TRAPS,
    mapsCrowdSignals: crowdRadar.signals,
  });
  const crowdFiltered = crowd.filtered_ids
    .map((id) => GEMS_BY_ID.get(id))
    .filter((g): g is HiddenGem => !!g);
  const warnedTraps = crowd.warned_traps
    .map((id) => TRAPS_BY_ID.get(id))
    .filter((t): t is TouristTrap => !!t);
  emit({
    type: "agent_complete",
    agent: "crowd-analyst",
    message: crowd.narration,
    data: {
      filtered_count: crowdFiltered.length,
      filtered_ids: crowdFiltered.map((g) => g.id),
      warned_traps: warnedTraps.map((t) => ({
        id: t.id,
        name_en: t.name_en,
        why_avoid: t.why_avoid,
      })),
      maps_radar: {
        checked_at: crowdRadar.checked_at,
        status: crowdRadar.status,
        signal_count: crowdRadar.signal_count,
        message: crowdRadar.message,
        trip_window: {
          start: tripStart,
          end: inferredTripEnd,
          days: inferredTripDays,
          holidays: crowdWindowHolidays.map((h) => ({
            date: h.date,
            name_en: h.name_en,
            crowd_impact: h.crowd_impact,
          })),
        },
        high_pressure: crowdRadar.signals.filter((s) => s.pressure === "high")
          .length,
        medium_pressure: crowdRadar.signals.filter(
          (s) => s.pressure === "medium"
        ).length,
        top_pressure: crowdRadar.signals
          .filter((s) => s.pressure !== "unknown")
          .sort((a, b) => (b.pressure_score ?? 0) - (a.pressure_score ?? 0))
          .slice(0, 3)
          .map((s) => ({
            gem_id: s.gem_id,
            pressure: s.pressure,
            score: s.pressure_score,
            reasons: s.reasons.slice(0, 2),
          })),
      },
      candidate_assessments: crowd.candidate_assessments,
      reasoning: crowd.reasoning,
    },
    timestamp: now(),
  });

  // 3. Curator — scores them
  emit({
    type: "agent_start",
    agent: "curator",
    message: startMessages.curator,
    timestamp: now(),
  });
  const curator = await runCurator({
    userPrompt,
    candidates: crowdFiltered.length > 0 ? crowdFiltered : listenerCandidates,
    webValidations: webEvidence.validations,
  });
  const sortedScored = [...curator.scored].sort((a, b) => b.score - a.score);
  emit({
    type: "agent_complete",
    agent: "curator",
    message: curator.narration,
    data: {
      top_picks: sortedScored.slice(0, 5).map((s) => {
        const g = GEMS_BY_ID.get(s.id);
        return {
          id: s.id,
          name_en: g?.name_en ?? s.id,
          score: s.score,
          why: s.why,
        };
      }),
      reasoning: curator.reasoning,
    },
    timestamp: now(),
  });

  // 4. Planner — geographic plan
  emit({
    type: "agent_start",
    agent: "planner",
    message: startMessages.planner,
    timestamp: now(),
  });
  const planner = await runPlanner({
    userPrompt,
    scored: sortedScored.map((s) => ({ id: s.id, score: s.score })),
    gemsById: GEMS_BY_ID,
  });
  planner.stays = normalizeStayNights(planner.stays, planner.days);
  const selectedGems = planner.selected_ids
    .map((id) => GEMS_BY_ID.get(id))
    .filter((g): g is HiddenGem => !!g);
  emit({
    type: "agent_complete",
    agent: "planner",
    message: planner.narration,
    data: {
      selected_ids: selectedGems.map((g) => g.id),
      day_count: planner.days?.length ?? 0,
      stay_count: planner.stays.length,
      total_nights: planner.stays.reduce((s, x) => s + x.nights, 0),
      reasoning: planner.reasoning,
    },
    timestamp: now(),
  });

  // 5. Weather Watcher + Verifier — run in parallel.
  //    Weather Watcher needs the planner's day list aligned to a 7-day forecast
  //    window (default trip-start lead time = 7 days from today). Verifier
  //    is independent of weather and just sanity-checks seasons/etiquette.
  emit({
    type: "agent_start",
    agent: "weather-watcher",
    message: startMessages["weather-watcher"],
    timestamp: now(),
  });
  emit({
    type: "agent_start",
    agent: "verifier",
    message: startMessages.verifier,
    timestamp: now(),
  });

  const weatherTask = (async () => {
    if (!planner.days || planner.days.length === 0) {
      return null;
    }
    // Open-Meteo forecasts max ~16 days out. If the user picked a trip that
    // starts beyond that window, the forecast is meaningless (it would just
    // repeat the last day's data). Skip the weather agent in that case so we
    // don't emit fabricated guidance.
    const tripStartOffset = Math.max(diffDaysISO(today, tripStart), 0);
    const lastTripOffset = tripStartOffset + planner.days.length - 1;
    if (lastTripOffset >= 16) {
      return { tooFar: true as const, daysAway: tripStartOffset };
    }
    // Unique bases keyed by gem_id, with their lat/lng.
    const uniqueBases = Array.from(
      new Set(planner.days.map((d) => d.stay_at))
    )
      .map((id) => GEMS_BY_ID.get(id))
      .filter((g): g is HiddenGem => !!g);

    if (uniqueBases.length === 0) return null;

    // We need 16 days max from Open-Meteo. Compute how many we need based on
    // trip start vs today, and clamp.
    const requested = Math.min(tripStartOffset + planner.days.length + 1, 16);
    const forecasts = await fetchForecastsForBases(
      uniqueBases.map((g) => ({ lat: g.lat, lng: g.lng })),
      requested,
      5000
    );

    // Map gem_id → forecast array
    const forecastByGemId = new Map<string, DailyWeather[]>();
    uniqueBases.forEach((g, i) => forecastByGemId.set(g.id, forecasts[i] ?? []));

    // Align trip days to forecast days using the actual trip start date.
    // Open-Meteo returns days starting today, so the offset is days-from-today.
    const daysWithForecast = planner.days.map((d) => {
      const fc = forecastByGemId.get(d.stay_at) ?? [];
      const idx = tripStartOffset + (d.day - 1);
      const forecast = fc[idx] ?? fc[fc.length - 1];
      return {
        day: d.day,
        title: d.title,
        stay_at: d.stay_at,
        morning: d.morning,
        afternoon: d.afternoon,
        evening: d.evening,
        forecast,
      };
    });

    // If we got no real forecast data, skip the agent step.
    if (daysWithForecast.every((d) => !d.forecast)) return null;

    const validDays = daysWithForecast.filter((d) => !!d.forecast);
    const watcher = await runWeatherWatcher({
      userPrompt,
      daysWithForecast: validDays,
    });

    return {
      watcher,
      daysWithForecast,
      uniqueBaseCount: uniqueBases.length,
      window: {
        start: validDays[0]?.forecast?.date ?? "",
        end: validDays[validDays.length - 1]?.forecast?.date ?? "",
      },
    };
  })().catch((err) => {
    // Weather is best-effort — never block the main pipeline.
    console.warn("[weather-watcher] failed:", err);
    return null;
  });

  // Compute trip date window + Thai holiday overlap. These are deterministic
  // (no LLM cost) and feed both the Verifier prompt and the final UI badges.
  const tripEnd = tripEndDate(tripStart, planner.days?.length ?? 1);
  const overlappingHolidays: ThaiHoliday[] = holidaysInRange(tripStart, tripEnd);

  const verifierTask = runVerifier({
    userPrompt,
    selected: selectedGems,
    tripDates: { start: tripStart, end: tripEnd },
    holidays: overlappingHolidays.map((h) => ({
      date: h.date,
      name_en: h.name_en,
      impact: h.impact,
      crowd_impact: h.crowd_impact,
      notes: h.notes,
    })),
  });

  const [weatherResult, verifier] = await Promise.all([
    weatherTask,
    verifierTask,
  ]);

  // Emit weather complete (or skipped if null/too-far).
  if (weatherResult && "tooFar" in weatherResult) {
    emit({
      type: "agent_complete",
      agent: "weather-watcher",
      message: `Trip is ${weatherResult.daysAway} days out — beyond Open-Meteo's 16-day forecast horizon. Skipped per-day weather; the season warning is already in the Verifier's notes.`,
      data: { skipped: true, days_away: weatherResult.daysAway },
      timestamp: now(),
    });
  } else if (weatherResult) {
    const adviceByDay = new Map(
      weatherResult.watcher.per_day_advice.map((p) => [p.day, p.advice])
    );
    emit({
      type: "agent_complete",
      agent: "weather-watcher",
      message: weatherResult.watcher.narration,
      data: {
        bases_checked: weatherResult.uniqueBaseCount,
        forecast_window: weatherResult.window,
        best_day_for_outdoor: weatherResult.watcher.best_day_for_outdoor,
        rainy_days: weatherResult.daysWithForecast.filter(
          (d) =>
            d.forecast &&
            (d.forecast.condition === "rain" ||
              d.forecast.condition === "thunderstorm" ||
              d.forecast.precip_probability >= 60)
        ).length,
        sunny_days: weatherResult.daysWithForecast.filter(
          (d) =>
            d.forecast &&
            (d.forecast.condition === "sunny" ||
              d.forecast.condition === "partly-cloudy")
        ).length,
        sample_advice: weatherResult.watcher.per_day_advice
          .slice(0, 2)
          .map((a) => `Day ${a.day}: ${a.advice}`),
      },
      timestamp: now(),
    });
    // Decorate planner days with weather + advice for the final result.
    if (planner.days) {
      const dayWeathers = new Map<number, DayWeather>();
      for (const d of weatherResult.daysWithForecast) {
        if (!d.forecast) continue;
        dayWeathers.set(d.day, {
          date: d.forecast.date,
          condition: d.forecast.condition,
          weather_code: d.forecast.weather_code,
          temp_max_c: d.forecast.temp_max_c,
          temp_min_c: d.forecast.temp_min_c,
          precip_probability: d.forecast.precip_probability,
          precip_mm: d.forecast.precip_mm,
          uv_index_max: d.forecast.uv_index_max,
          advice: adviceByDay.get(d.day),
        });
      }
      planner.days = planner.days.map((d) => ({
        ...d,
        weather: dayWeathers.get(d.day),
      })) as typeof planner.days;
    }
  } else {
    emit({
      type: "agent_complete",
      agent: "weather-watcher",
      message: "Weather forecast was unavailable for this run — skipping advice.",
      data: { skipped: true },
      timestamp: now(),
    });
  }

  emit({
    type: "agent_complete",
    agent: "verifier",
    message: verifier.narration,
    data: {
      warnings: verifier.warnings,
      tips: verifier.tips,
      is_valid: verifier.is_valid,
    },
    timestamp: now(),
  });

  // Filter stays to those whose anchor gem actually exists in our dataset.
  const validStays = planner.stays.filter((s) => GEMS_BY_ID.has(s.gem_id));

  // Pull from planner.days (which we mutated above with weather) so the final
  // result carries weather + advice on each day. Also attach the actual
  // calendar date and any Thai holiday that lands on that date.
  const holidayByDate = new Map(overlappingHolidays.map((h) => [h.date, h]));
  const finalDays = planner.days?.map((d) => {
    const date = addDaysISO(tripStart, d.day - 1);
    const holiday = holidayByDate.get(date);
    return {
      ...d,
      is_transfer_day: d.is_transfer_day ?? false,
      date,
      holiday: holiday
        ? {
            date: holiday.date,
            name_en: holiday.name_en,
            name_th: holiday.name_th,
            impact: holiday.impact,
            crowd_impact: holiday.crowd_impact,
            notes: holiday.notes,
            day: d.day,
          }
        : undefined,
    };
  }) as ItineraryDay[] | undefined;

  // Compose final
  const final: FinalItinerary = {
    summary: planner.narration,
    reasoning:
      `${listener.reasoning} ${crowd.reasoning} ${curator.reasoning} ${planner.reasoning} ${verifier.narration}`.trim(),
    selected_gems: selectedGems,
    avoided_traps: warnedTraps.map((t) => t.name_en),
    stays: validStays,
    days: finalDays,
    tips: verifier.tips,
    web_evidence: webEvidence,
    weather:
      weatherResult && !("tooFar" in weatherResult)
        ? {
            forecast_window: weatherResult.window,
            best_day_for_outdoor: weatherResult.watcher.best_day_for_outdoor,
            note: weatherResult.watcher.narration,
          }
        : undefined,
    trip_dates: { start: tripStart, end: tripEnd },
    holidays: overlappingHolidays.map((h) => {
      const dayIndex = diffDaysISO(tripStart, h.date) + 1;
      return {
        date: h.date,
        name_en: h.name_en,
        name_th: h.name_th,
        impact: h.impact,
        crowd_impact: h.crowd_impact,
        notes: h.notes,
        day:
          dayIndex >= 1 && dayIndex <= (planner.days?.length ?? 0)
            ? dayIndex
            : undefined,
      };
    }),
    crowd_radar: crowdRadar,
  };

  emit({
    type: "final_result",
    agent: "orchestrator",
    data: final,
    timestamp: now(),
  });
  emit({
    type: "agent_complete",
    agent: "orchestrator",
    message: `All seven agents finished in ${((now() - start) / 1000).toFixed(1)}s.`,
    timestamp: now(),
  });
  emit({ type: "done", timestamp: now() });
}
