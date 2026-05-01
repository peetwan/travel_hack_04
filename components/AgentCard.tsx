"use client";

import { motion } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentName, AgentStatus } from "@/lib/types";

const META: Record<
  AgentName,
  {
    title: string;
    subtitle: string;
    Icon: React.ElementType;
    accentText: string;
    accentBg: string;
    accentBorder: string;
  }
> = {
  orchestrator: {
    title: "Orchestrator",
    subtitle: "Routes work between agents",
    Icon: Sparkles,
    accentText: "text-[var(--gold)]",
    accentBg: "bg-[#fdf6e3]",
    accentBorder: "border-[var(--gold-soft)]",
  },
  listener: {
    title: "Local Listener",
    subtitle: "Surfaces candidates from curated dataset",
    Icon: Compass,
    accentText: "text-[var(--saffron)]",
    accentBg: "bg-[var(--saffron-tint)]",
    accentBorder: "border-[var(--border-saffron)]",
  },
  "web-pulse": {
    title: "Web Pulse",
    subtitle: "Live Tavily + Exa search of Thai blogs",
    Icon: Globe,
    accentText: "text-[var(--jade)]",
    accentBg: "bg-[var(--jade-tint)]",
    accentBorder: "border-[var(--jade-soft)]",
  },
  "crowd-analyst": {
    title: "Crowd Analyst",
    subtitle: "Filters traps & overcrowded spots",
    Icon: Users,
    accentText: "text-[var(--burgundy)]",
    accentBg: "bg-[#fdf2f2]",
    accentBorder: "border-[var(--burgundy-soft)]",
  },
  curator: {
    title: "Cultural Curator",
    subtitle: "Scores fit against your vibe + web evidence",
    Icon: Heart,
    accentText: "text-[var(--saffron)]",
    accentBg: "bg-[var(--saffron-tint)]",
    accentBorder: "border-[var(--border-saffron)]",
  },
  planner: {
    title: "Route Planner",
    subtitle: "Slow travel — 1–2 bases, day trips",
    Icon: Map,
    accentText: "text-[var(--jade)]",
    accentBg: "bg-[var(--jade-tint)]",
    accentBorder: "border-[var(--jade-soft)]",
  },
  "weather-watcher": {
    title: "Weather Watcher",
    subtitle: "Open-Meteo forecast aligned to each day",
    Icon: CloudSun,
    accentText: "text-[var(--saffron)]",
    accentBg: "bg-[var(--saffron-tint)]",
    accentBorder: "border-[var(--border-saffron)]",
  },
  verifier: {
    title: "Verifier",
    subtitle: "Sanity-checks seasons, holidays & etiquette",
    Icon: ShieldCheck,
    accentText: "text-[var(--gold)]",
    accentBg: "bg-[#fdf6e3]",
    accentBorder: "border-[var(--gold-soft)]",
  },
};

export interface AgentCardProps {
  name: AgentName;
  status: AgentStatus;
  message?: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

export function AgentCard({
  name,
  status,
  message,
  data,
  durationMs,
}: AgentCardProps) {
  const meta = META[name];
  const Icon = meta.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative flex gap-4 rounded-2xl border bg-[var(--surface)] p-4 transition-all",
        status === "thinking"
          ? `${meta.accentBorder} shadow-[var(--shadow-md)]`
          : status === "done"
            ? "border-[var(--border)] shadow-[var(--shadow-xs)]"
            : status === "error"
              ? "border-rose-300 shadow-[var(--shadow-xs)]"
              : "border-[var(--border)] opacity-70"
      )}
    >
      {status === "thinking" && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl",
            meta.accentBg,
            "opacity-30"
          )}
        />
      )}
      <div
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
          meta.accentBg,
          meta.accentBorder,
          meta.accentText
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold tracking-tight text-[var(--foreground)]">
            {meta.title}
          </h3>
          <StatusBadge status={status} durationMs={durationMs} />
        </div>
        <p className="text-xs text-[var(--muted)]">{meta.subtitle}</p>
        {message && (
          <p
            className={cn(
              "mt-1 text-sm leading-relaxed",
              status === "thinking"
                ? `${meta.accentText} font-medium`
                : "text-[var(--foreground)]"
            )}
          >
            {status === "thinking" ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 animate-pulse rounded-full",
                    meta.accentText.replace("text-", "bg-")
                  )}
                />
                {message}
              </span>
            ) : (
              message
            )}
          </p>
        )}
        {data && status === "done" ? (
          <DataSummary name={name} data={data} />
        ) : null}
      </div>
    </motion.div>
  );
}

function StatusBadge({
  status,
  durationMs,
}: {
  status: AgentStatus;
  durationMs?: number;
}) {
  if (status === "idle")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--subtle)]">
        <CircleDot className="h-3 w-3" /> Idle
      </span>
    );
  if (status === "thinking")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--saffron)]">
        <Loader2 className="h-3 w-3 animate-spin" /> Working
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-widest text-rose-600">
        Error
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">
      <Check className="h-3 w-3 text-[var(--jade)]" />
      {durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "Done"}
    </span>
  );
}

function DataSummary({
  name,
  data,
}: {
  name: AgentName;
  data: Record<string, unknown>;
}) {
  if (name === "listener" && typeof data.candidate_count === "number") {
    return (
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
        → surfaced {data.candidate_count} candidates
      </p>
    );
  }
  if (name === "web-pulse") {
    const hits = data.hit_count as number | undefined;
    const supports = data.supports as number | undefined;
    const contradicts = data.contradicts as number | undefined;
    const samples = data.sample_sources as
      | { title: string; url: string }[]
      | undefined;
    return (
      <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-[var(--muted)]">
        <span>
          → {hits ?? 0} hits · {supports ?? 0} support · {contradicts ?? 0}{" "}
          contradict
        </span>
        {samples && samples.length > 0 && (
          <span className="truncate text-[var(--subtle)]">
            sources:{" "}
            {samples
              .map((s) => {
                try {
                  return new URL(s.url).hostname.replace(/^www\./, "");
                } catch {
                  return s.url;
                }
              })
              .join(" · ")}
          </span>
        )}
      </div>
    );
  }
  if (name === "crowd-analyst") {
    const filtered = data.filtered_count as number | undefined;
    const traps = data.warned_traps as { name_en: string }[] | undefined;
    return (
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-[var(--muted)]">
        {filtered !== undefined && <span>→ kept {filtered}</span>}
        {traps && traps.length > 0 && (
          <span>→ flagged {traps.map((t) => t.name_en).join(", ")}</span>
        )}
      </div>
    );
  }
  if (name === "curator") {
    const top = data.top_picks as
      | { name_en: string; score: number }[]
      | undefined;
    if (!top) return null;
    return (
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
        → top: {top[0]?.name_en} ({(top[0]?.score * 100).toFixed(0)}%)
      </p>
    );
  }
  if (name === "planner") {
    const ids = data.selected_ids as string[] | undefined;
    const days = data.day_count as number | undefined;
    const stays = data.stay_count as number | undefined;
    const nights = data.total_nights as number | undefined;
    return (
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
        → {ids?.length ?? 0} gems · {stays ?? 0}{" "}
        {(stays ?? 0) === 1 ? "base" : "bases"}
        {nights ? ` · ${nights} nights` : ""}
        {days ? ` · ${days} days` : ""}
      </p>
    );
  }
  if (name === "weather-watcher") {
    if (data.skipped) {
      const days = data.days_away as number | undefined;
      return (
        <p className="mt-1 font-mono text-xs text-[var(--muted)]">
          → {days ? `trip ${days}d away — beyond 16d horizon` : "forecast unavailable, skipped"}
        </p>
      );
    }
    const sunny = data.sunny_days as number | undefined;
    const rainy = data.rainy_days as number | undefined;
    const best = data.best_day_for_outdoor as number | null | undefined;
    const window_ = data.forecast_window as
      | { start?: string; end?: string }
      | undefined;
    return (
      <div className="mt-1 flex flex-col gap-1 font-mono text-xs text-[var(--muted)]">
        <span>
          → {sunny ?? 0} clear · {rainy ?? 0} rainy
          {best ? ` · best outdoor: day ${best}` : ""}
        </span>
        {window_?.start && (
          <span className="text-[var(--subtle)]">
            window: {window_.start} → {window_.end}
          </span>
        )}
      </div>
    );
  }
  if (name === "verifier") {
    const warnings = data.warnings as string[] | undefined;
    return (
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
        → {warnings?.length ?? 0} warnings, plan{" "}
        {data.is_valid ? "valid" : "needs review"}
      </p>
    );
  }
  return null;
}
