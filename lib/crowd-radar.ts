import type {
  CrowdPressure,
  CrowdSignalAdjustment,
  HiddenGem,
  MapsCrowdReport,
  MapsCrowdSignal,
  WebEvidence,
} from "./types";
import type { ThaiHoliday } from "./thai-holidays";

const TOUR_PRESSURE_TERMS = [
  "tripadvisor",
  "klook",
  "getyourguide",
  "full-day tour",
  "day tour",
  "first timers",
  "must-visit",
  "night market",
  "tour bus",
  "queue",
  "crowd",
  "packed",
  "busy",
];

const QUIET_SIGNAL_TERMS = [
  "quiet",
  "peaceful",
  "hidden",
  "local",
  "off the beaten",
  "slow",
  "serene",
];

function scoreToPressure(score: number): CrowdPressure {
  if (score >= 2.75) return "high";
  if (score >= 1.25) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tripDates(startISO: string, days: number): string[] {
  return Array.from({ length: Math.max(days, 1) }, (_, i) =>
    addDaysISO(startISO, i)
  );
}

function dateIsWeekend(iso: string): boolean {
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[()–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function webTextForGem(gem: HiddenGem, evidence?: WebEvidence): string {
  if (!evidence) return "";
  const names = [
    normalize(gem.name_en),
    normalize(gem.name_th),
    normalize(gem.id.replace(/-/g, " ")),
  ].filter((name) => name.length > 3);

  const validationText = evidence.validations
    .filter((v) => v.gem_id === gem.id)
    .map((v) => `${v.verdict} ${v.quote}`)
    .join(" ");

  const hitText = evidence.hits
    .filter((hit) => {
      const body = normalize(`${hit.title} ${hit.snippet} ${hit.url}`);
      return names.some((name) => body.includes(name));
    })
    .map((hit) => `${hit.title} ${hit.snippet} ${hit.url}`)
    .join(" ");

  return normalize(`${validationText} ${hitText}`);
}

function webAdjustment(gem: HiddenGem, evidence?: WebEvidence): CrowdSignalAdjustment | null {
  const text = webTextForGem(gem, evidence);
  if (!text) return null;

  const tourTerms = TOUR_PRESSURE_TERMS.filter((term) => text.includes(term));
  const quietTerms = QUIET_SIGNAL_TERMS.filter((term) => text.includes(term));
  const weight = Math.min(tourTerms.length * 0.45, 1.4) - Math.min(quietTerms.length * 0.2, 0.6);
  if (Math.abs(weight) < 0.25) return null;

  return {
    source: "web-pulse",
    pressure: weight > 0 ? (weight >= 1 ? "medium" : "low") : "low",
    weight,
    reason:
      weight > 0
        ? `Live web snippets contain tourism-pressure terms: ${tourTerms.slice(0, 3).join(", ")}.`
        : `Live web snippets contain quiet-place terms: ${quietTerms.slice(0, 3).join(", ")}.`,
  };
}

function calendarAdjustments(args: {
  tripStart: string;
  tripDays: number;
  holidays: ThaiHoliday[];
}): CrowdSignalAdjustment[] {
  const dates = tripDates(args.tripStart, args.tripDays);
  const adjustments: CrowdSignalAdjustment[] = [];
  const weekendCount = dates.filter(dateIsWeekend).length;
  const highHolidays = args.holidays.filter((h) => h.crowd_impact === "high");
  const mediumHolidays = args.holidays.filter((h) => h.crowd_impact === "medium");

  if (weekendCount > 0) {
    adjustments.push({
      source: "trip-calendar",
      pressure: "medium",
      weight: Math.min(weekendCount * 0.35, 0.8),
      reason: `${weekendCount} trip day${weekendCount === 1 ? "" : "s"} land on a weekend.`,
    });
  }
  if (highHolidays.length > 0) {
    adjustments.push({
      source: "trip-calendar",
      pressure: "high",
      weight: Math.min(highHolidays.length * 1.2, 2),
      reason: `High-crowd Thai holiday overlap: ${highHolidays
        .map((h) => h.name_en)
        .join(", ")}.`,
    });
  }
  if (mediumHolidays.length > 0) {
    adjustments.push({
      source: "trip-calendar",
      pressure: "medium",
      weight: Math.min(mediumHolidays.length * 0.55, 1.1),
      reason: `Medium-crowd Thai holiday overlap: ${mediumHolidays
        .map((h) => h.name_en)
        .join(", ")}.`,
    });
  }

  return adjustments;
}

export function inferTripDaysFromPrompt(prompt: string): number {
  const lower = prompt.toLowerCase();
  const explicitDays = lower.match(/\b(\d{1,2})\s*(day|days|วัน)\b/);
  if (explicitDays) return Math.min(Math.max(Number(explicitDays[1]), 1), 14);
  const explicitNights = lower.match(/\b(\d{1,2})\s*(night|nights|คืน)\b/);
  if (explicitNights) return Math.min(Math.max(Number(explicitNights[1]) + 1, 1), 14);
  if (/\bweekend\b|เสาร์อาทิตย์/.test(lower)) return 2;
  if (/\bweek\b|สัปดาห์|อาทิตย์/.test(lower)) return 7;
  return 3;
}

export function enrichCrowdReport(args: {
  report: MapsCrowdReport;
  gems: HiddenGem[];
  tripStart: string;
  tripDays: number;
  holidays: ThaiHoliday[];
  webEvidence?: WebEvidence;
}): MapsCrowdReport {
  const gemsById = new Map(args.gems.map((gem) => [gem.id, gem]));
  const calendar = calendarAdjustments({
    tripStart: args.tripStart,
    tripDays: args.tripDays,
    holidays: args.holidays,
  });

  const signals: MapsCrowdSignal[] = args.report.signals.map((signal) => {
    const gem = gemsById.get(signal.gem_id);
    const adjustments = [...(signal.adjustments ?? []), ...calendar];
    if (gem) {
      const web = webAdjustment(gem, args.webEvidence);
      if (web) adjustments.push(web);
    }

    const baseScore = signal.pressure_score ?? 0;
    const score = Math.max(
      0,
      baseScore +
        adjustments
          .filter((adj) => adj.source !== "google-maps")
          .reduce((sum, adj) => sum + adj.weight, 0)
    );
    const pressure = scoreToPressure(score);

    return {
      ...signal,
      pressure,
      pressure_score: Number(score.toFixed(2)),
      adjustments,
      reasons: [
        ...signal.reasons,
        ...adjustments
          .filter((adj) => adj.source !== "google-maps")
          .map((adj) => adj.reason),
      ],
    };
  });

  return {
    ...args.report,
    signals,
  };
}
