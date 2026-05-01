import type {
  CrowdSignalAdjustment,
  CrowdPressure,
  GemCategory,
  HiddenGem,
  MapsCrowdReport,
  MapsCrowdSignal,
} from "./types";

const PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours",
  "places.primaryType",
  "places.types",
  "places.googleMapsUri",
].join(",");

interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  primaryType?: string;
  types?: string[];
  googleMapsUri?: string;
}

interface GoogleTextSearchResponse {
  places?: GooglePlace[];
}

interface GoogleErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function hasGoogleMapsKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

const REVIEW_THRESHOLDS: Record<
  GemCategory,
  { medium: number; high: number; veryHigh: number }
> = {
  village: { medium: 250, high: 1500, veryHigh: 5000 },
  nature: { medium: 500, high: 2500, veryHigh: 8000 },
  temple: { medium: 350, high: 2000, veryHigh: 7000 },
  beach: { medium: 500, high: 3000, veryHigh: 10000 },
  adventure: { medium: 300, high: 1500, veryHigh: 5000 },
  culture: { medium: 250, high: 1500, veryHigh: 5000 },
  food: { medium: 200, high: 1000, veryHigh: 3000 },
};

function scoreToPressure(score: number): CrowdPressure {
  if (score >= 2.75) return "high";
  if (score >= 1.25) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function pressureFromPlace(place: GooglePlace, gem: HiddenGem): {
  pressure: CrowdPressure;
  score: number;
  reasons: string[];
  adjustment: CrowdSignalAdjustment;
} {
  const count = place.userRatingCount ?? 0;
  const reasons: string[] = [];
  const thresholds = REVIEW_THRESHOLDS[gem.category];
  let score = 0;

  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
    reasons.push(`Google Maps status is ${place.businessStatus}.`);
    score += 3;
  }
  if (typeof place.currentOpeningHours?.openNow === "boolean") {
    reasons.push(
      place.currentOpeningHours.openNow
        ? "Google Maps says it is open now."
        : "Google Maps says it is not open now."
    );
  }
  if (place.rating && count > 0) {
    reasons.push(`${count.toLocaleString()} Google reviews at ${place.rating}/5.`);
  } else if (count > 0) {
    reasons.push(`${count.toLocaleString()} Google reviews.`);
  }

  if (count >= thresholds.veryHigh) {
    score += 3;
    reasons.push(
      `Very high review volume for a ${gem.category} suggests mainstream tourist pressure.`
    );
  } else if (count >= thresholds.high) {
    score += 2;
    reasons.push(
      `High review volume for a ${gem.category} suggests it is no longer fully under-the-radar.`
    );
  } else if (count >= thresholds.medium) {
    score += 1;
    reasons.push(
      `Moderate review volume for a ${gem.category} suggests some traveller visibility.`
    );
  }

  if (count > 0) {
    const pressure = scoreToPressure(score);
    if (pressure === "low") {
      reasons.push("Low review volume supports a quieter-place read.");
    }
    return {
      pressure,
      score,
      reasons,
      adjustment: {
        source: "google-maps",
        pressure,
        weight: score,
        reason: `${count.toLocaleString()} Google reviews calibrated for ${gem.category}.`,
      },
    };
  }

  return {
    pressure: "unknown",
    score,
    reasons: reasons.length ? reasons : ["Google Maps returned no review volume."],
    adjustment: {
      source: "google-maps",
      pressure: "unknown",
      weight: 0,
      reason: "Google Maps returned no review volume.",
    },
  };
}

function emptySignal(
  gem: HiddenGem,
  checkedAt: string,
  status: MapsCrowdSignal["status"],
  message: string
): MapsCrowdSignal {
  return {
    gem_id: gem.id,
    checked_at: checkedAt,
    status,
    pressure: "unknown",
    pressure_score: 0,
    confidence: "low",
    reasons: [message],
    adjustments: [],
    message,
  };
}

async function googleErrorMessage(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as GoogleErrorResponse | null;
  const status = data?.error?.status;
  const message = data?.error?.message;
  const hint =
    res.status === 403
      ? "Enable Places API (New) for this key, or use a server-allowed key if the current key is browser/referrer restricted."
      : undefined;
  return [
    `Google Places returned HTTP ${res.status}`,
    status ? ` (${status})` : null,
    message ? `: ${message}` : ".",
    hint ? ` ${hint}` : "",
  ]
    .filter(Boolean)
    .join("");
}

function bestPlaceMatch(gem: HiddenGem, places: GooglePlace[]): {
  place: GooglePlace;
  distanceKm?: number;
} | null {
  const scored = places
    .map((place) => {
      const loc = place.location;
      const distanceKm =
        typeof loc?.latitude === "number" && typeof loc?.longitude === "number"
          ? haversineKm(
              { lat: gem.lat, lng: gem.lng },
              { lat: loc.latitude, lng: loc.longitude }
            )
          : undefined;
      return { place, distanceKm };
    })
    .filter((x) => x.place.id);

  if (scored.length === 0) return null;
  scored.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  const best = scored[0];
  if (typeof best.distanceKm === "number" && best.distanceKm > 15) return null;
  return best;
}

async function fetchSignalForGem(
  gem: HiddenGem,
  checkedAt: string,
  signal?: AbortSignal
): Promise<MapsCrowdSignal> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return emptySignal(
      gem,
      checkedAt,
      "missing-key",
      "GOOGLE_MAPS_API_KEY is not configured."
    );
  }

  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${gem.name_en} ${gem.name_th} ${gem.province} Thailand`,
      pageSize: 3,
      languageCode: "en",
      regionCode: "TH",
      locationBias: {
        circle: {
          center: { latitude: gem.lat, longitude: gem.lng },
          radius: 5000,
        },
      },
    }),
    signal,
  });

  if (!res.ok) {
    const message = await googleErrorMessage(res);
    return emptySignal(
      gem,
      checkedAt,
      "error",
      message
    );
  }

  const data = (await res.json()) as GoogleTextSearchResponse;
  const match = bestPlaceMatch(gem, data.places ?? []);
  if (!match?.place) {
    return emptySignal(
      gem,
      checkedAt,
      "no-match",
      "No close Google Maps place match was found near the curated coordinates."
    );
  }

  const { place, distanceKm } = match;
  const pressure = pressureFromPlace(place, gem);
  if (typeof distanceKm === "number") {
    pressure.reasons.push(`Matched ${distanceKm.toFixed(1)} km from curated point.`);
  }

  return {
    gem_id: gem.id,
    checked_at: checkedAt,
    status: "ok",
    pressure: pressure.pressure,
    pressure_score: pressure.score,
    confidence:
      typeof place.userRatingCount === "number" || place.businessStatus
        ? "high"
        : "medium",
    reasons: pressure.reasons,
    adjustments: [pressure.adjustment],
    matched_place: {
      id: place.id ?? "",
      name: place.displayName?.text ?? gem.name_en,
      business_status: place.businessStatus,
      open_now: place.currentOpeningHours?.openNow,
      rating: place.rating,
      user_rating_count: place.userRatingCount,
      primary_type: place.primaryType,
      types: place.types,
      google_maps_uri: place.googleMapsUri,
      match_distance_km:
        typeof distanceKm === "number" ? Number(distanceKm.toFixed(1)) : undefined,
    },
  };
}

export interface GeocodedDiscovery {
  name: string;
  lat: number;
  lng: number;
  google_maps_uri?: string;
  user_rating_count?: number;
  rating?: number;
  business_status?: string;
}

const GEOCODE_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
].join(",");

export async function geocodeDiscoveredPlace(args: {
  name_en: string;
  name_th?: string;
  province: string;
  signal?: AbortSignal;
}): Promise<GeocodedDiscovery | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return null;

  const namePart = [args.name_en, args.name_th].filter(Boolean).join(" / ");
  const textQuery = `${namePart} ${args.province} Thailand`;

  let res: Response;
  try {
    res = await fetch(PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": GEOCODE_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 3,
        languageCode: "en",
        regionCode: "TH",
      }),
      signal: args.signal,
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | GoogleTextSearchResponse
    | null;
  const place = data?.places?.find(
    (p) =>
      typeof p.location?.latitude === "number" &&
      typeof p.location?.longitude === "number"
  );
  if (!place || !place.location) return null;
  if (
    place.businessStatus &&
    place.businessStatus !== "OPERATIONAL" &&
    place.businessStatus !== ""
  ) {
    return null;
  }
  return {
    name: place.displayName?.text ?? args.name_en,
    lat: place.location.latitude!,
    lng: place.location.longitude!,
    google_maps_uri: place.googleMapsUri,
    user_rating_count: place.userRatingCount,
    rating: place.rating,
    business_status: place.businessStatus,
  };
}

export async function fetchMapsCrowdSignals(args: {
  gems: HiddenGem[];
  timeoutMs?: number;
}): Promise<MapsCrowdReport> {
  const checkedAt = new Date().toISOString();

  if (!hasGoogleMapsKey()) {
    const signals = args.gems.map((gem) =>
      emptySignal(
        gem,
        checkedAt,
        "missing-key",
        "GOOGLE_MAPS_API_KEY is not configured."
      )
    );
    return {
      provider: "google-maps",
      checked_at: checkedAt,
      status: "missing-key",
      signal_count: 0,
      message: "Google Maps crowd radar skipped because the API key is missing.",
      signals,
    };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), args.timeoutMs ?? 7000);
  try {
    const settled = await Promise.allSettled(
      args.gems.map((gem) => fetchSignalForGem(gem, checkedAt, ac.signal))
    );
    const signals = settled.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      const timeout =
        result.reason instanceof Error && result.reason.name === "AbortError";
      return emptySignal(
        args.gems[index],
        checkedAt,
        timeout ? "timeout" : "error",
        timeout
          ? "Google Places timed out before returning a signal."
          : result.reason instanceof Error
            ? result.reason.message
            : "Google Places signal failed."
      );
    });
    const okCount = signals.filter((s) => s.status === "ok").length;
    return {
      provider: "google-maps",
      checked_at: checkedAt,
      status: okCount > 0 ? "ok" : signals[0]?.status ?? "error",
      signal_count: okCount,
      message:
        okCount > 0
          ? `Google Maps returned ${okCount}/${args.gems.length} usable place signals.`
          : "Google Maps returned no usable place signals.",
      signals,
    };
  } finally {
    clearTimeout(timer);
  }
}
