"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Loader2,
  MapPinned,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DestinationSuggestion } from "@/lib/types";

const EXAMPLES = [
  {
    label: "Peaceful beaches",
    prompt: "Peaceful beaches, no party scene, good seafood, 5 days.",
  },
  {
    label: "Temple culture",
    prompt: "Temples, local culture, vegetarian-friendly, hate crowds.",
  },
  {
    label: "Slow wellness reset",
    prompt: "Relaxing wellness trip, Thai spa or onsen, quiet mornings, 4 days.",
  },
  {
    label: "Family nature",
    prompt: "Family-friendly nature, easy walks, wildlife, not too touristy.",
  },
];

const REGION_LABELS: Record<DestinationSuggestion["region"], string> = {
  north: "North",
  northeast: "Northeast",
  central: "Central",
  east: "East",
  south: "South",
  west: "West",
};

function defaultStartDate(): string {
  const d = new Date();
  const day = d.getDay();
  const offset = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatGemId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Home() {
  const router = useRouter();
  const [stylePrompt, setStylePrompt] = useState("");
  const [startDate, setStartDate] = useState<string>(() => defaultStartDate());
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayMin = useMemo(() => todayISO(), []);

  const selected = suggestions.find((s) => s.id === selectedId) ?? null;

  function updatePrompt(nextPrompt: string) {
    setStylePrompt(nextPrompt);
    setError(null);
    if (suggestions.length > 0) {
      setSuggestions([]);
      setSelectedId(null);
    }
  }

  function updateStartDate(nextDate: string) {
    setStartDate(nextDate);
    setError(null);
    if (suggestions.length > 0) {
      setSuggestions([]);
      setSelectedId(null);
    }
  }

  async function fetchSuggestions() {
    const trimmed = stylePrompt.trim();
    if (!trimmed) return;

    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/destination-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stylePrompt: trimmed,
          startDate: startDate || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { suggestions?: DestinationSuggestion[]; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const nextSuggestions = data?.suggestions ?? [];
      if (nextSuggestions.length === 0) {
        throw new Error("No destination clusters came back for this style.");
      }
      setSuggestions(nextSuggestions);
      setSelectedId(nextSuggestions[0].id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not scout destination clusters."
      );
    } finally {
      setSuggesting(false);
    }
  }

  function sendSelectedToAgents() {
    if (!selected) return;
    setSubmitting(true);
    const params = new URLSearchParams({
      q: selected.composed_prompt,
      destinationTitle: selected.title,
    });
    if (startDate) params.set("start", startDate);
    router.push(`/discover?${params.toString()}`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || suggesting || !stylePrompt.trim()) return;
    if (suggestions.length === 0) {
      await fetchSuggestions();
      return;
    }
    sendSelectedToAgents();
  }

  const primaryButtonLabel =
    suggestions.length === 0
      ? suggesting
        ? "Scouting…"
        : "Scout destinations"
      : submitting
        ? "Routing…"
        : "Send selected to agents";

  return (
    <main className="relative flex flex-1 flex-col">
      {/* Decorative top motif */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-pattern-thai" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-60" />

      {/* Top brand strip */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-saffron shadow-[var(--shadow-saffron)]">
            <span className="font-display text-base font-bold text-white">H</span>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Hidden Siam
          </span>
        </div>
        <div className="hidden items-center gap-3 text-xs text-[var(--muted)] sm:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--jade)]" />
            Scout first · agents route next
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-stretch gap-12 px-6 pb-24 pt-12 sm:gap-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--saffron)]">
            <Sparkles className="h-3 w-3" />
            Built against overtourism
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-7xl">
            Find the{" "}
            <span className="relative inline-block">
              <span className="relative z-10 italic">other</span>
              <span className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-full bg-[var(--saffron-soft)]/60 sm:bottom-2 sm:h-4" />
            </span>{" "}
            Thailand.
          </h1>
          <p className="max-w-xl text-balance text-lg leading-relaxed text-[var(--muted-foreground)]">
            Tell us your travel style first. Hidden Siam scouts a few Thailand
            clusters for you, then the agent crew builds the route around the
            one you choose.
          </p>
        </section>

        {/* Composer */}
        <section className="relative">
          {/* Soft saffron glow under composer */}
          <div className="absolute -inset-x-8 -inset-y-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[var(--saffron-tint)] via-transparent to-[var(--jade-tint)] blur-2xl opacity-70" />
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]"
          >
            <Textarea
              value={stylePrompt}
              onChange={(e) => updatePrompt(e.target.value)}
              placeholder="e.g. peaceful beaches, no party scene, good seafood, 5 days."
              disabled={suggesting || submitting}
              className="min-h-[100px] border-0 bg-transparent text-base shadow-none focus:ring-0"
            />
            <div className="flex flex-col gap-3 border-t border-[var(--border)] px-1 pb-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="flex flex-col gap-1.5">
                <span className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  Trip starts
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-sm transition-colors focus-within:border-[var(--saffron)] focus-within:ring-2 focus-within:ring-[var(--saffron)]/20">
                  <CalendarDays className="h-4 w-4 text-[var(--muted)]" />
                  <input
                    type="date"
                    value={startDate}
                    min={todayMin}
                    onChange={(e) => updateStartDate(e.target.value)}
                    disabled={suggesting || submitting}
                    className="bg-transparent text-sm text-[var(--foreground)] outline-none"
                  />
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                {suggestions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={suggesting || submitting}
                    onClick={fetchSuggestions}
                  >
                    {suggesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    suggesting ||
                    submitting ||
                    !stylePrompt.trim() ||
                    (suggestions.length > 0 && !selected)
                  }
                  className="sm:min-w-[220px]"
                >
                  {suggesting || submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : suggestions.length === 0 ? (
                    <Compass className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {primaryButtonLabel}
                </Button>
              </div>
            </div>
          </form>

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                    Destination shortlist
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--foreground)]">
                    Pick your Thailand cluster
                  </h2>
                </div>
                <span className="rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1 font-mono text-xs text-[var(--saffron)]">
                  {suggestions.length} options
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {suggestions.map((suggestion) => {
                  const isSelected = suggestion.id === selectedId;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(suggestion.id)}
                      className={`group flex min-h-[250px] flex-col gap-4 rounded-2xl border bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-xs)] transition-all hover:-translate-y-0.5 hover:border-[var(--border-saffron)] hover:shadow-[var(--shadow-sm)] ${
                        isSelected
                          ? "border-[var(--saffron)] ring-2 ring-[var(--saffron)]/20"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-display text-xl font-semibold leading-tight text-[var(--foreground)]">
                            {suggestion.title}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                            {suggestion.subtitle}
                          </p>
                        </div>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isSelected
                              ? "bg-[var(--saffron)] text-white"
                              : "bg-[var(--saffron-tint)] text-[var(--saffron)]"
                          }`}
                        >
                          {isSelected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <MapPinned className="h-4 w-4" />
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[var(--jade-tint)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--jade)]">
                          {REGION_LABELS[suggestion.region]}
                        </span>
                        {suggestion.provinces.map((province) => (
                          <span
                            key={province}
                            className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]"
                          >
                            {province}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {suggestion.style_tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--saffron-tint)] px-2.5 py-1 text-xs text-[var(--saffron)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <p className="text-sm leading-relaxed text-[var(--foreground)]">
                        {suggestion.why}
                      </p>
                      <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {suggestion.avoidance_note}
                      </p>

                      <div className="mt-auto flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                          Anchor gems
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.anchor_gem_ids.map((id) => (
                            <span
                              key={id}
                              className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]"
                            >
                              {formatGemId(id)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Examples — horizontal cards beneath composer */}
          <div className="mt-5 flex flex-col gap-2.5">
            <p className="px-1 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Try a starter
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => updatePrompt(ex.prompt)}
                  disabled={suggesting || submitting}
                  className="group flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-all hover:border-[var(--border-saffron)] hover:bg-[var(--saffron-tint)] hover:shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-display text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--saffron)]">
                    {ex.label}
                  </span>
                  <span className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {ex.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
