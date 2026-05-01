"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  Bed,
  ArrowRight,
  Sun,
  CloudSun,
  MapPin,
  CloudRain,
  CloudFog,
  Cloud,
  Zap,
  Trophy,
  CalendarHeart,
  Megaphone,
  Utensils,
} from "lucide-react";
import { AgentCrewPanel, type AgentRow } from "@/components/AgentCrewPanel";
import { GemCard } from "@/components/GemCard";
import { WellnessCard } from "@/components/WellnessCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AgentEvent,
  AgentName,
  AgentStatus,
  DayWeather,
  FinalItinerary,
  ThaiHolidayHit,
  WeatherCondition,
} from "@/lib/types";

const ItineraryMap = dynamic(() => import("@/components/ItineraryMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

const AGENT_ORDER: AgentName[] = [
  "orchestrator",
  "listener",
  "web-pulse",
  "wellness-pulse",
  "crowd-analyst",
  "curator",
  "planner",
  "weather-watcher",
  "verifier",
];

interface AgentState {
  status: AgentStatus;
  message?: string;
  data?: Record<string, unknown>;
  startedAt?: number;
  finishedAt?: number;
}

const initialAgents = (): Record<AgentName, AgentState> =>
  Object.fromEntries(
    AGENT_ORDER.map((n) => [n, { status: "idle" } as AgentState])
  ) as Record<AgentName, AgentState>;

export default function DiscoverPage() {
  return (
    <Suspense fallback={<DiscoverFallback />}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverFallback() {
  return (
    <main className="flex flex-1 items-center justify-center text-sm text-zinc-500">
      Loading…
    </main>
  );
}

function DiscoverInner() {
  const params = useSearchParams();
  const prompt = params.get("q") ?? "";
  const startDate = params.get("start") ?? "";
  const [agents, setAgents] = useState<Record<AgentName, AgentState>>(
    initialAgents()
  );
  const [final, setFinal] = useState<FinalItinerary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!prompt) return;

    // No startedRef guard: in React dev/Strict Mode the effect runs twice;
    // the first run is aborted by cleanup and the second run is the one that
    // actually streams events. Guarding with a ref left agents stuck in IDLE.
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            startDate: startDate || undefined,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (!cancelled) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buf += decoder.decode(value, { stream: true });

          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const evt = JSON.parse(json) as AgentEvent;
              applyEvent(evt);
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Something broke while contacting the agents."
        );
      }
    })();

    function applyEvent(evt: AgentEvent) {
      if (evt.type === "agent_start" && evt.agent) {
        setAgents((prev) => ({
          ...prev,
          [evt.agent!]: {
            ...prev[evt.agent!],
            status: "thinking",
            message: evt.message,
            startedAt: evt.timestamp,
          },
        }));
      } else if (evt.type === "agent_complete" && evt.agent) {
        setAgents((prev) => ({
          ...prev,
          [evt.agent!]: {
            ...prev[evt.agent!],
            status: "done",
            message: evt.message ?? prev[evt.agent!].message,
            data: evt.data as Record<string, unknown> | undefined,
            finishedAt: evt.timestamp,
          },
        }));
      } else if (
        (evt.type === "agent_progress" || evt.type === "agent_thinking") &&
        evt.agent
      ) {
        setAgents((prev) => ({
          ...prev,
          [evt.agent!]: {
            ...prev[evt.agent!],
            status:
              prev[evt.agent!].status === "idle"
                ? "thinking"
                : prev[evt.agent!].status,
            message: evt.message ?? prev[evt.agent!].message,
            data: evt.data as Record<string, unknown> | undefined,
          },
        }));
      } else if (evt.type === "agent_error" && evt.agent) {
        setAgents((prev) => ({
          ...prev,
          [evt.agent!]: {
            ...prev[evt.agent!],
            status: "error",
            message: evt.message,
          },
        }));
      } else if (evt.type === "final_result") {
        setFinal(evt.data as FinalItinerary);
      } else if (evt.type === "error") {
        setError(evt.message ?? "Unknown error");
      } else if (evt.type === "done") {
        setDone(true);
      }
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [prompt, startDate]);

  const subAgents = useMemo(
    () => AGENT_ORDER.filter((n) => n !== "orchestrator"),
    []
  );

  const crewRows: AgentRow[] = subAgents.map((name) => {
    const s = agents[name];
    return {
      name,
      status: s.status,
      message: s.message,
      data: s.data,
      durationMs:
        s.startedAt && s.finishedAt ? s.finishedAt - s.startedAt : undefined,
    };
  });

  // Total time = orchestrator finishedAt - earliest startedAt (or fallback)
  const totalDurationMs = (() => {
    const orch = agents.orchestrator;
    if (!done || !orch.startedAt) return undefined;
    const ends = subAgents
      .map((n) => agents[n].finishedAt)
      .filter((t): t is number => !!t);
    if (ends.length === 0) return undefined;
    return Math.max(...ends) - orch.startedAt;
  })();

  if (!prompt) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-20 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-semibold">
            No prompt provided.
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Go back home and tell the agents how you want to travel.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="primary">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-2.5 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-saffron text-white">
                <span className="font-display text-xs font-bold">H</span>
              </span>
              <span className="font-display text-base font-semibold tracking-tight text-[var(--foreground)]">
                Hidden Siam
              </span>
            </span>
          </Link>
          {done && !error && final && (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1.5 font-mono text-xs text-[var(--saffron)]">
              <Sparkles className="h-3 w-3" />
              {final.selected_gems.length} gems · {final.avoided_traps.length}{" "}
              traps avoided
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        {/* Prompt panel */}
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)]">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Your prompt
            </p>
            {startDate && (
              <p className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--muted-foreground)]">
                <span className="text-[var(--muted)]">trip starts</span>
                <span className="rounded-md bg-[var(--saffron-tint)] px-2 py-0.5 text-[var(--saffron)]">
                  {startDate}
                </span>
              </p>
            )}
          </div>
          <p className="font-display text-xl leading-snug text-[var(--foreground)]">
            “{prompt}”
          </p>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5 text-rose-600" />
            <div>
              <p className="font-medium">The agent crew tripped.</p>
              <p className="mt-1 text-rose-700">{error}</p>
              <p className="mt-2 text-xs text-rose-600">
                Most common cause: <code>GOOGLE_GENERATIVE_AI_API_KEY</code> not
                set in <code>.env.local</code>.
              </p>
            </div>
          </div>
        )}

        {/* Single crew panel — collapsible vertical list, one row per agent */}
        <AgentCrewPanel rows={crewRows} totalDurationMs={totalDurationMs} />

        <AnimatePresence>
          {final && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-10"
            >
              <ItineraryHero final={final} />
              <ItineraryMapHero gems={final.selected_gems} />
              <DayTimeline final={final} />
              <WellnessFinds final={final} />
              <LiveFinds final={final} />
              <ResultFooter final={final} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// Hero panel for the result section. Pure typography — no cards, no clutter.
// Shows the planner's narration as a serif headline, plus a single line of
// inline stats and avoided traps.
function ItineraryHero({ final }: { final: FinalItinerary }) {
  const totalNights = final.stays.reduce((s, x) => s + x.nights, 0);
  const stats = [
    `${final.selected_gems.length} ${final.selected_gems.length === 1 ? "gem" : "gems"}`,
    `${final.stays.length} ${final.stays.length === 1 ? "base" : "bases"}`,
    totalNights ? `${totalNights} ${totalNights === 1 ? "night" : "nights"}` : null,
    final.days?.length ? `${final.days.length} ${final.days.length === 1 ? "day" : "days"}` : null,
    final.avoided_traps.length
      ? `${final.avoided_traps.length} traps avoided`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
        Your itinerary
      </p>
      <h2 className="font-display text-3xl font-semibold leading-[1.15] tracking-tight text-[var(--foreground)] sm:text-4xl">
        {final.summary}
      </h2>
      <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-[var(--muted-foreground)]">
        {stats.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-3">
            <span>{s}</span>
            {i < stats.length - 1 && (
              <span className="text-[var(--subtle)]">·</span>
            )}
          </span>
        ))}
      </p>
      {final.avoided_traps.length > 0 && (
        <p className="text-sm text-[var(--muted-foreground)]">
          Skipped:{" "}
          <span className="text-[var(--burgundy)]">
            {final.avoided_traps.join(" · ")}
          </span>
        </p>
      )}
    </div>
  );
}

// Map as a hero visual — full-width, taller. Pins speak louder than 2-col cards.
function ItineraryMapHero({ gems }: { gems: FinalItinerary["selected_gems"] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] shadow-[var(--shadow-sm)]">
      <div className="h-[420px] sm:h-[480px]">
        <ItineraryMap gems={gems} />
      </div>
    </div>
  );
}

// Live finds — places Web Pulse discovered in fresh Thai-source hits that aren't
// in our curated dataset. Geocoded via Google Places, shown alongside the
// curated itinerary as additional leads (not part of the planned route).
function LiveFinds({ final }: { final: FinalItinerary }) {
  const finds = final.discovered_gems ?? [];
  if (finds.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[var(--border-saffron)] bg-[var(--saffron-tint)]/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
            <Sparkles className="h-3 w-3" />
            Live finds · {finds.length} {finds.length === 1 ? "place" : "places"}
          </p>
          <h3 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">
            Found in fresh Thai web hits — not in our curated set yet
          </h3>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Web Pulse surfaced these from live Thai-source articles. Coordinates
            confirmed via Google Maps, but they have not been TAT-verified or
            crowd-checked. Treat as leads, not vetted picks.
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {finds.map((find) => {
          let host = find.source_url;
          try {
            host = new URL(find.source_url).hostname.replace(/^www\./, "");
          } catch {
            /* keep raw */
          }
          return (
            <li
              key={find.id}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)]"
            >
              <div className="flex flex-col gap-0.5">
                <h4 className="font-display text-base font-semibold leading-tight text-[var(--foreground)]">
                  {find.name_en}
                  {find.name_th && (
                    <span className="ml-1.5 font-sans text-xs font-normal text-[var(--muted)]">
                      · {find.name_th}
                    </span>
                  )}
                </h4>
                <p className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--muted)]">
                  <MapPin className="h-3 w-3" />
                  {find.province}
                  {typeof find.google_review_count === "number" && (
                    <span className="ml-1">
                      · {find.google_review_count.toLocaleString()} Maps reviews
                      {typeof find.google_rating === "number"
                        ? ` · ${find.google_rating.toFixed(1)}★`
                        : ""}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                {find.why}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-1 text-xs">
                <a
                  href={find.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[var(--jade)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {host}
                  {find.source_published_at ? ` · ${find.source_published_at}` : ""}
                </a>
                {find.google_maps_uri && (
                  <a
                    href={find.google_maps_uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[var(--saffron)] hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    Open in Maps
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Wellness finds — curated Thai wellness venues (data/wellness_local.json)
// cross-validated by the Wellness Pulse agent against trip provinces, then
// against Google Places (rating ≥4.3, reviews ≥100, business OPERATIONAL).
// Distinct visual treatment from "Live finds": jade + gold (wellness palette),
// Thai-character signals up front, awards block.
function WellnessFinds({ final }: { final: FinalItinerary }) {
  const finds = final.wellness_finds ?? [];
  if (finds.length === 0) return null;

  const diag = final.wellness_diagnostics;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--jade-soft)] bg-gradient-to-br from-[var(--jade-tint)]/60 via-[var(--surface)] to-[#fdf6e3]/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--jade)]">
            <Sparkles className="h-3 w-3" />
            Thai wellness picks · {finds.length} {finds.length === 1 ? "venue" : "venues"} · cross-validated
          </p>
          <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)]">
            Where to slow down — quality Thai wellness, hand-picked
          </h3>
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            Cross-checked across four sources: a hand-curated dataset, TAT SHA
            certification, luxury-travel editorial mentions, and live Google
            Places ratings (≥4.3, ≥100 reviews, currently operating). Boutique
            and Thai-heritage venues only — no chain spas.
            {diag?.search_status === "missing-key" ? " Live editorial search skipped (no Tavily/Exa key set)." : null}
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {finds.map((venue, i) => (
          <li key={venue.id}>
            <WellnessCard venue={venue} index={i} />
          </li>
        ))}
      </ul>
      <p className="border-t border-[var(--border)] pt-3 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Curated dataset · TAT SHA · Forbes / Condé Nast / Travel + Leisure ·
        Google Places
      </p>
    </div>
  );
}

// Footer: gems list + the prominent Verifier tips block.
// Live web sources + Maps crowd radar were removed — those signals already
// surface inside individual GemCards (Maps pressure chip + reviews) and the
// Web Pulse agent line; doubling them in the footer was visual noise.
function ResultFooter({ final }: { final: FinalItinerary }) {
  const hasTips = final.tips.length > 0;
  const crowdSignalsByGem = new Map(
    final.crowd_radar?.signals.map((signal) => [signal.gem_id, signal]) ?? []
  );
  return (
    <div className="flex flex-col gap-10 border-t border-[var(--border)] pt-8">
      {/* Gems list — keep visible since users want to know what they get */}
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            What you&apos;re visiting
          </h3>
          <a
            href="https://www.tourismthailand.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] transition-colors hover:text-[var(--saffron)]"
          >
            Cross-check with TAT
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {final.selected_gems.map((g, i) => (
            <GemCard
              key={g.id}
              gem={g}
              index={i}
              crowdSignal={crowdSignalsByGem.get(g.id)}
            />
          ))}
        </div>
      </div>

      {hasTips && (
        <section className="overflow-hidden rounded-3xl border border-[var(--border-saffron)] bg-gradient-to-br from-[var(--saffron-tint)] via-[var(--surface)] to-[#fdf6e3] p-6 shadow-[var(--shadow-xs)] sm:p-10">
          <div className="mb-7 flex flex-col gap-2">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
              <Sparkles className="h-3 w-3" />
              Local intel · Verifier
            </p>
            <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-3xl">
              Notes from the local guide
            </h3>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)]">
              The kind of detail a generic AI itinerary skips — etiquette,
              seasonal gear, holiday-aware tweaks, and small things that change
              the day.
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {final.tips.map((t, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.06 }}
                className="flex items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)] transition-all hover:border-[var(--border-saffron)] hover:shadow-[var(--shadow-sm)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--saffron)] font-display text-base font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-[15px] leading-relaxed text-[var(--foreground)]">
                  {t}
                </p>
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StayPlan({ final }: { final: FinalItinerary }) {
  if (!final.stays || final.stays.length === 0) return null;
  const gemsById = new Map(final.selected_gems.map((g) => [g.id, g]));
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Stay plan
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {final.stays.map((stay, i) => {
          const gem = gemsById.get(stay.gem_id);
          return (
            <motion.div
              key={`${stay.gem_id}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border-saffron)] bg-gradient-to-br from-[var(--saffron-tint)] via-[var(--surface)] to-[var(--surface)] p-4 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-saffron)] bg-[var(--saffron-tint)] text-[var(--saffron)]">
                  <Bed className="h-4 w-4" />
                </div>
                <div className="flex flex-1 items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
                    Base {i + 1}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted-foreground)]">
                    {stay.nights} {stay.nights === 1 ? "night" : "nights"}
                  </span>
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold leading-tight text-[var(--foreground)]">
                {gem?.name_en ?? stay.gem_id}
              </h3>
              {gem && (
                <p className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                  <MapPin className="h-3 w-3" />
                  {gem.province}
                </p>
              )}
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                {stay.why_this_base}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const WEATHER_META: Record<
  WeatherCondition,
  { Icon: React.ElementType; label: string; tone: string }
> = {
  sunny: {
    Icon: Sun,
    label: "Clear",
    tone: "text-[var(--saffron)] border-[var(--border-saffron)] bg-[var(--saffron-tint)]",
  },
  "partly-cloudy": {
    Icon: CloudSun,
    label: "Partly cloudy",
    tone: "text-[var(--jade)] border-[var(--jade-soft)] bg-[var(--jade-tint)]",
  },
  overcast: {
    Icon: Cloud,
    label: "Overcast",
    tone: "text-[var(--muted-foreground)] border-[var(--border-strong)] bg-[var(--surface-soft)]",
  },
  fog: {
    Icon: CloudFog,
    label: "Fog",
    tone: "text-[var(--muted-foreground)] border-[var(--border-strong)] bg-[var(--surface-soft)]",
  },
  drizzle: {
    Icon: CloudRain,
    label: "Drizzle",
    tone: "text-sky-700 border-sky-200 bg-sky-50",
  },
  rain: {
    Icon: CloudRain,
    label: "Rain",
    tone: "text-blue-700 border-blue-200 bg-blue-50",
  },
  thunderstorm: {
    Icon: Zap,
    label: "Storm",
    tone: "text-violet-700 border-violet-200 bg-violet-50",
  },
};

function HolidayChip({ holiday }: { holiday: ThaiHolidayHit }) {
  const tone =
    holiday.crowd_impact === "high"
      ? "text-[var(--burgundy)] border-[var(--burgundy-soft)] bg-[#fdf2f2]"
      : holiday.crowd_impact === "medium"
        ? "text-[var(--gold)] border-[var(--gold-soft)] bg-[#fdf6e3]"
        : "text-[var(--muted-foreground)] border-[var(--border-strong)] bg-[var(--surface-soft)]";
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${tone}`}
      title={holiday.notes ?? `${holiday.name_th} (${holiday.impact})`}
    >
      <CalendarHeart className="h-3.5 w-3.5" />
      <span className="font-medium">{holiday.name_en}</span>
      <span className="opacity-50">·</span>
      <span className="font-mono text-[10px] uppercase tracking-widest">
        {holiday.crowd_impact} crowd
      </span>
    </div>
  );
}

function WeatherChip({
  weather,
  isBestOutdoor,
}: {
  weather: DayWeather;
  isBestOutdoor: boolean;
}) {
  const meta = WEATHER_META[weather.condition];
  const Icon = meta.Icon;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${meta.tone}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{meta.label}</span>
      <span className="opacity-50">·</span>
      <span className="font-mono">
        {weather.temp_min_c}°–{weather.temp_max_c}°
      </span>
      {weather.precip_probability >= 30 && (
        <>
          <span className="opacity-50">·</span>
          <span className="font-mono">{weather.precip_probability}% rain</span>
        </>
      )}
      {isBestOutdoor && (
        <>
          <span className="opacity-50">·</span>
          <span
            className="inline-flex items-center gap-1 font-semibold text-[var(--gold)]"
            title="Best forecast for outdoor activity"
          >
            <Trophy className="h-3 w-3" />
            best
          </span>
        </>
      )}
    </div>
  );
}

// Morning + afternoon are structured DayActivity blocks (place + activity +
// optional gem_id). Evening is a structured restaurant pick (name + why).
// Renderers: ActivityBlock for morning/afternoon, DinnerBlock for dinner.

const WEEKDAYS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function formatDayDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS_FULL[d.getUTCDay()]}, ${
    MONTHS_SHORT[d.getUTCMonth()]
  } ${d.getUTCDate()}`;
}

// One day inside the timeline. Uses a label/description grid so the body
// reads as a single document instead of three separate boxes.
function DayRow({
  day: d,
  isBestOutdoor,
  mapsUriByGemId,
}: {
  day: NonNullable<FinalItinerary["days"]>[number];
  isBestOutdoor: boolean;
  mapsUriByGemId: Map<string, string>;
}) {
  const dayName = d.date ? formatDayDate(d.date) : null;
  return (
    <li className="flex flex-col gap-4 p-5 sm:p-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h4 className="flex items-baseline gap-2.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
              Day {d.day}
            </span>
            <span className="font-display text-xl font-semibold leading-tight text-[var(--foreground)]">
              {d.title}
            </span>
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.weather && (
              <WeatherChip weather={d.weather} isBestOutdoor={isBestOutdoor} />
            )}
            {d.holiday && <HolidayChip holiday={d.holiday} />}
            {d.is_transfer_day && (
              <Badge variant="warning" className="shrink-0">
                Transfer
              </Badge>
            )}
          </div>
        </div>
        {dayName && (
          <p className="font-mono text-xs text-[var(--muted)]">{dayName}</p>
        )}
      </header>

      {d.weather?.advice && (
        <p className="border-l-2 border-[var(--saffron)] pl-3.5 text-sm italic leading-relaxed text-[var(--muted-foreground)]">
          {d.weather.advice}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[100px_1fr] sm:gap-y-4">
        {d.morning && (
          <ActivityBlock
            label="Morning"
            Icon={Sun}
            accent="text-[var(--saffron)]"
            activity={d.morning}
            mapsUri={
              d.morning.gem_id ? mapsUriByGemId.get(d.morning.gem_id) : undefined
            }
          />
        )}
        {d.afternoon && (
          <ActivityBlock
            label="Afternoon"
            Icon={CloudSun}
            accent="text-[var(--jade)]"
            activity={d.afternoon}
            mapsUri={
              d.afternoon.gem_id
                ? mapsUriByGemId.get(d.afternoon.gem_id)
                : undefined
            }
          />
        )}
        {d.evening_dinner && (
          <DinnerBlock dinner={d.evening_dinner} />
        )}
      </dl>
    </li>
  );
}

function ActivityBlock({
  label,
  Icon,
  accent,
  activity,
  mapsUri,
}: {
  label: string;
  Icon: React.ElementType;
  accent: string;
  activity: NonNullable<
    NonNullable<FinalItinerary["days"]>[number]["morning"]
  >;
  mapsUri?: string;
}) {
  return (
    <>
      <dt
        className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${accent} sm:pt-1`}
      >
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="flex flex-col gap-1">
        {mapsUri ? (
          <a
            href={mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-1.5 self-start font-display text-[17px] font-semibold leading-snug text-[var(--foreground)] transition-colors hover:text-[var(--saffron)]"
          >
            {activity.place}
            <MapPin className="h-3 w-3 translate-y-0.5 text-[var(--muted)] transition-colors group-hover:text-[var(--saffron)]" />
          </a>
        ) : (
          <span className="font-display text-[17px] font-semibold leading-snug text-[var(--foreground)]">
            {activity.place}
          </span>
        )}
        <span className="text-[14px] leading-relaxed text-[var(--muted-foreground)]">
          {activity.activity}
        </span>
      </dd>
    </>
  );
}

function DinnerBlock({
  dinner,
}: {
  dinner: NonNullable<
    NonNullable<FinalItinerary["days"]>[number]["evening_dinner"]
  >;
}) {
  return (
    <>
      <dt className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--burgundy)] sm:pt-1">
        <Utensils className="h-3 w-3" />
        Dinner
      </dt>
      <dd className="flex flex-col gap-1">
        <span className="font-display text-[17px] font-semibold leading-snug text-[var(--foreground)]">
          {dinner.name}
        </span>
        <span className="text-[14px] leading-relaxed text-[var(--muted-foreground)]">
          {dinner.why}
        </span>
      </dd>
    </>
  );
}

function DayTimeline({ final }: { final: FinalItinerary }) {
  if (!final.days || final.days.length === 0) return null;
  const gemsById = new Map(final.selected_gems.map((g) => [g.id, g]));
  // Crowd radar carries each selected gem's matched Google Maps URI — used to
  // turn a morning/afternoon `place` into a clickable Maps link when the
  // planner referenced a gem_id.
  const mapsUriByGemId = new Map<string, string>();
  for (const signal of final.crowd_radar?.signals ?? []) {
    const uri = signal.matched_place?.google_maps_uri;
    if (uri) mapsUriByGemId.set(signal.gem_id, uri);
  }
  const bestOutdoor = final.weather?.best_day_for_outdoor ?? null;

  // Group consecutive days that share the same `stay_at` so the user sees
  // "Days 1–3 at Mae Kampong" as a coherent block instead of three loose cards.
  const blocks: Array<{ stay_at: string; days: typeof final.days }> = [];
  for (const d of final.days) {
    const last = blocks[blocks.length - 1];
    if (last && last.stay_at === d.stay_at) {
      last.days.push(d);
    } else {
      blocks.push({ stay_at: d.stay_at, days: [d] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Day by day
          </p>
          {final.trip_dates && (
            <p className="font-mono text-xs text-[var(--muted)]">
              {final.trip_dates.start} → {final.trip_dates.end}
            </p>
          )}
        </div>
        {final.weather?.note && (
          <p className="flex items-start gap-2.5 rounded-2xl border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-4 py-3 text-sm text-[var(--foreground)]">
            <CloudSun className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--saffron)]" />
            <span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
                Weather Watcher
              </span>
              <br />
              <span className="text-[var(--muted-foreground)]">
                {final.weather.note}
              </span>
            </span>
          </p>
        )}
        {final.holidays && final.holidays.some((h) => h.crowd_impact === "high") && (
          <p className="flex items-start gap-2.5 rounded-2xl border border-[var(--burgundy-soft)] bg-[#fdf2f2] px-4 py-3 text-sm text-[var(--foreground)]">
            <Megaphone className="h-4 w-4 shrink-0 translate-y-0.5 text-[var(--burgundy)]" />
            <span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--burgundy)]">
                Heads up — Thai holiday in window
              </span>
              <br />
              <span className="text-[var(--muted-foreground)]">
                {final.holidays
                  .filter((h) => h.crowd_impact === "high")
                  .map((h) =>
                    h.day
                      ? `${h.name_en} on day ${h.day} (${h.date})`
                      : `${h.name_en} (${h.date})`
                  )
                  .join(" · ")}
                {" — expect crowds well above the gem's normal level."}
              </span>
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {blocks.map((block, blockIdx) => {
          const gem = gemsById.get(block.stay_at);
          const dayLabel =
            block.days.length === 1
              ? `Day ${block.days[0].day}`
              : `Days ${block.days[0].day}–${block.days[block.days.length - 1].day}`;
          // Lift the matching stay so we can show the base reason inline.
          const stay = final.stays.find((s) => s.gem_id === block.stay_at);
          return (
            <div key={blockIdx} className="flex flex-col">
              {blockIdx > 0 && (
                <div className="mb-3 ml-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  <ArrowRight className="h-3 w-3 text-[var(--saffron)]" />
                  Transfer to next base
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
                <div className="flex flex-col gap-1.5 border-b border-[var(--border)] bg-[var(--surface-soft)] px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <Bed className="h-3.5 w-3.5 translate-y-0.5 text-[var(--saffron)]" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
                        {dayLabel}
                      </span>
                      <span className="font-display text-base font-semibold text-[var(--foreground)]">
                        {gem?.name_en ?? block.stay_at}
                      </span>
                      {gem && (
                        <span className="text-xs text-[var(--muted)]">
                          {gem.province}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      {block.days.length}{" "}
                      {block.days.length === 1 ? "night" : "nights"}
                    </span>
                  </div>
                  {stay?.why_this_base && (
                    <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                      {stay.why_this_base}
                    </p>
                  )}
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {block.days.map((d) => (
                    <DayRow
                      key={d.day}
                      day={d}
                      isBestOutdoor={bestOutdoor === d.day}
                      mapsUriByGemId={mapsUriByGemId}
                    />
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
