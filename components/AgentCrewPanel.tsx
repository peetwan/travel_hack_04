"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Users,
  Heart,
  Map,
  ShieldCheck,
  Sparkles,
  CircleDot,
  Loader2,
  Check,
  Globe,
  CloudSun,
  ChevronDown,
  Leaf,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AgentName, AgentStatus } from "@/lib/types";

const META: Record<
  AgentName,
  {
    title: string;
    Icon: React.ElementType;
    accent: string;
    bg: string;
  }
> = {
  orchestrator: {
    title: "Orchestrator",
    Icon: Sparkles,
    accent: "text-[var(--gold)]",
    bg: "bg-[#fdf6e3]",
  },
  listener: {
    title: "Local Listener",
    Icon: Compass,
    accent: "text-[var(--saffron)]",
    bg: "bg-[var(--saffron-tint)]",
  },
  "web-pulse": {
    title: "Web Pulse",
    Icon: Globe,
    accent: "text-[var(--jade)]",
    bg: "bg-[var(--jade-tint)]",
  },
  "wellness-pulse": {
    title: "Wellness Pulse",
    Icon: Leaf,
    accent: "text-[var(--gold)]",
    bg: "bg-[#fdf6e3]",
  },
  "crowd-analyst": {
    title: "Crowd Analyst",
    Icon: Users,
    accent: "text-[var(--burgundy)]",
    bg: "bg-[#fdf2f2]",
  },
  curator: {
    title: "Cultural Curator",
    Icon: Heart,
    accent: "text-[var(--saffron)]",
    bg: "bg-[var(--saffron-tint)]",
  },
  planner: {
    title: "Route Planner",
    Icon: Map,
    accent: "text-[var(--jade)]",
    bg: "bg-[var(--jade-tint)]",
  },
  "weather-watcher": {
    title: "Weather Watcher",
    Icon: CloudSun,
    accent: "text-[var(--saffron)]",
    bg: "bg-[var(--saffron-tint)]",
  },
  verifier: {
    title: "Verifier",
    Icon: ShieldCheck,
    accent: "text-[var(--gold)]",
    bg: "bg-[#fdf6e3]",
  },
};

export interface AgentRow {
  name: AgentName;
  status: AgentStatus;
  message?: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

export function AgentCrewPanel({
  rows,
  totalDurationMs,
}: {
  rows: AgentRow[];
  totalDurationMs?: number;
}) {
  const allDone = rows.every((r) => r.status === "done" || r.status === "error");
  const anyError = rows.some((r) => r.status === "error");
  const activeIdx = rows.findIndex((r) => r.status === "thinking");
  const [expanded, setExpanded] = useState(true);

  // Auto-collapse once finished, but only on the first transition.
  // (User can re-expand manually.)
  if (allDone && expanded && totalDurationMs === undefined) {
    // no-op — can't usefully toggle in render
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--surface-soft)]"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              allDone && !anyError
                ? "bg-[var(--jade-tint)] text-[var(--jade)]"
                : anyError
                  ? "bg-[#fdf2f2] text-[var(--burgundy)]"
                  : "bg-[var(--saffron-tint)] text-[var(--saffron)]"
            )}
          >
            {allDone && !anyError ? (
              <Check className="h-4 w-4" />
            ) : anyError ? (
              <CircleDot className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </span>
          <div className="flex flex-col">
            <span className="font-display text-sm font-semibold text-[var(--foreground)]">
              The crew at work
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              {allDone
                ? `${rows.length} agents · finished in ${
                    totalDurationMs
                      ? (totalDurationMs / 1000).toFixed(1) + "s"
                      : "—"
                  }`
                : activeIdx >= 0
                  ? `Step ${activeIdx + 1} of ${rows.length} · ${
                      META[rows[activeIdx].name].title
                    }`
                  : `${rows.length} agents queued`}
            </span>
          </div>
        </div>

        {/* Stepper dots — quick visual for status across all agents */}
        <div className="hidden items-center gap-1 sm:flex">
          {rows.map((r) => {
            const m = META[r.name];
            return (
              <span
                key={r.name}
                title={m.title}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  r.status === "done"
                    ? "bg-[var(--jade)]"
                    : r.status === "thinking"
                      ? "animate-pulse bg-[var(--saffron)]"
                      : r.status === "error"
                        ? "bg-[var(--burgundy)]"
                        : "bg-[var(--border-strong)]"
                )}
              />
            );
          })}
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 text-[var(--muted)] transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {rows.map((row) => {
                const meta = META[row.name];
                const Icon = meta.Icon;
                const status = row.status;
                return (
                  <li
                    key={row.name}
                    className={cn(
                      "flex items-start gap-3 px-5 py-3 transition-colors",
                      status === "thinking" && "bg-[var(--saffron-tint)]/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        meta.bg,
                        meta.accent,
                        status === "idle" && "opacity-40"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "font-display text-sm font-semibold",
                            status === "idle"
                              ? "text-[var(--subtle)]"
                              : "text-[var(--foreground)]"
                          )}
                        >
                          {meta.title}
                        </span>
                        <StatusLabel status={status} durationMs={row.durationMs} />
                      </div>
                      {row.message && status !== "idle" && (
                        <p
                          className={cn(
                            "text-xs leading-relaxed",
                            status === "thinking"
                              ? meta.accent + " font-medium"
                              : "text-[var(--muted-foreground)]"
                          )}
                        >
                          {row.message}
                        </p>
                      )}
                      <AgentDataSummary row={row} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AgentDataSummary({ row }: { row: AgentRow }) {
  if (!row.data || row.status === "idle") return null;

  const chips = summaryChips(row);
  if (chips.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function summaryChips(row: AgentRow): string[] {
  const data = row.data ?? {};
  const chips: string[] = [];
  const numberChip = (key: string, label: string) => {
    const value = data[key];
    if (typeof value === "number") chips.push(`${value} ${label}`);
  };

  if (row.name === "listener") {
    numberChip("candidate_count", "candidates");
  }

  if (row.name === "web-pulse") {
    numberChip("hit_count", "hits");
    numberChip("validation_count", "validations");
    if (typeof data.discovered_count === "number" && data.discovered_count > 0) {
      chips.push(`${data.discovered_count} live finds`);
    }
    const searchedAt = formatSearchedAt(data.searched_at);
    if (searchedAt) chips.push(`searched ${searchedAt}`);
    const sourceCounts = formatSourceCounts(data.source_counts);
    if (sourceCounts) chips.push(sourceCounts);
    const providerIssues = formatProviderIssues(data.provider_statuses);
    if (providerIssues) chips.push(providerIssues);
  }

  if (row.name === "wellness-pulse") {
    if (data.skipped === true) {
      chips.push("wellness skipped");
    } else {
      numberChip("validated_count", "validated");
      numberChip("picked_count", "picks");
      if (typeof data.live_boost_status === "string") {
        chips.push(`editorial ${data.live_boost_status}`);
      }
      if (typeof data.live_boost_hits === "number" && data.live_boost_hits > 0) {
        chips.push(`${data.live_boost_hits} editorial hits`);
      }
    }
  }

  if (row.name === "crowd-analyst") {
    numberChip("filtered_count", "kept");
    const radar = data.maps_radar;
    if (radar && typeof radar === "object") {
      const r = radar as Record<string, unknown>;
      if (typeof r.signal_count === "number") {
        chips.push(`${r.signal_count} Maps signals`);
      }
      if (typeof r.high_pressure === "number" && r.high_pressure > 0) {
        chips.push(`${r.high_pressure} high pressure`);
      }
    }
    const traps = data.warned_traps;
    if (Array.isArray(traps) && traps.length > 0) {
      chips.push(`${traps.length} traps flagged`);
    }
  }

  if (row.name === "curator") {
    const picks = data.top_picks;
    if (Array.isArray(picks) && picks.length > 0) chips.push(`${picks.length} scored picks`);
  }

  if (row.name === "planner") {
    numberChip("day_count", "days");
    numberChip("stay_count", "bases");
  }

  if (row.name === "weather-watcher") {
    if (data.skipped === true) {
      chips.push("weather skipped");
    } else {
      numberChip("bases_checked", "bases checked");
      numberChip("rainy_days", "rainy days");
<<<<<<< HEAD
=======
      numberChip("hazy_days", "hazy days");
>>>>>>> 8f57626 (Test)
      const window = data.forecast_window;
      if (window && typeof window === "object") {
        const { start, end } = window as { start?: unknown; end?: unknown };
        if (typeof start === "string" && typeof end === "string") {
          chips.push(`${start} to ${end}`);
        }
      }
    }
  }

  if (row.name === "verifier") {
    const warnings = data.warnings;
    if (Array.isArray(warnings)) chips.push(`${warnings.length} warnings`);
  }

  return chips.slice(0, 4);
}

function formatSearchedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSourceCounts(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const counts = value as Record<string, unknown>;
  const parts = [
    typeof counts.tavily === "number" ? `Tavily ${counts.tavily}` : null,
    typeof counts.exa === "number" ? `Exa ${counts.exa}` : null,
    typeof counts.firecrawl === "number" ? `pages ${counts.firecrawl}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function formatProviderIssues(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const issues = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const report = item as { provider?: unknown; status?: unknown };
      if (typeof report.provider !== "string" || typeof report.status !== "string") {
        return null;
      }
      if (report.status === "ok" || report.status === "skipped") return null;
      return `${report.provider} ${report.status}`;
    })
    .filter(Boolean);
  return issues.length ? issues.join(" · ") : null;
}

function StatusLabel({
  status,
  durationMs,
}: {
  status: AgentStatus;
  durationMs?: number;
}) {
  if (status === "idle")
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--subtle)]">
        Queued
      </span>
    );
  if (status === "thinking")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[var(--saffron)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Working
      </span>
    );
  if (status === "error")
    return (
      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--burgundy)]">
        Error
      </span>
    );
  return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
      {durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "Done"}
    </span>
  );
}
