"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Loader2,
  MapPinned,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DestinationSuggestion } from "@/lib/types";

const REGION_LABELS: Record<DestinationSuggestion["region"], string> = {
  north: "North",
  northeast: "Northeast",
  central: "Central",
  east: "East",
  south: "South",
  west: "West",
};

function formatGemId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function DestinationsPage() {
  return (
    <Suspense fallback={<DestinationsFallback />}>
      <DestinationsInner />
    </Suspense>
  );
}

function DestinationsFallback() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20 text-center">
      <div className="flex flex-col items-center gap-3 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--saffron)]" />
        Loading destination scout…
      </div>
    </main>
  );
}

function DestinationsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const stylePrompt = params.get("style")?.trim() ?? "";
  const startDate = params.get("start")?.trim() ?? "";
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routingId, setRoutingId] = useState<string | null>(null);

  const hasPrompt = stylePrompt.length >= 4;
  const requestBody = useMemo(
    () => ({
      stylePrompt,
      startDate: startDate || undefined,
    }),
    [stylePrompt, startDate]
  );

  useEffect(() => {
    if (!hasPrompt) return;
    const controller = new AbortController();
    let cancelled = false;

    async function loadSuggestions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/destination-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as
          | { suggestions?: DestinationSuggestion[]; error?: string }
          | null;
        if (!res.ok) {
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setSuggestions(data?.suggestions ?? []);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not scout destination clusters."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSuggestions();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasPrompt, requestBody]);

  async function retry() {
    if (!hasPrompt || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/destination-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await res.json().catch(() => null)) as
        | { suggestions?: DestinationSuggestion[]; error?: string }
        | null;
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSuggestions(data?.suggestions ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not scout destination clusters."
      );
    } finally {
      setLoading(false);
    }
  }

  function chooseSuggestion(suggestion: DestinationSuggestion) {
    setRoutingId(suggestion.id);
    const next = new URLSearchParams({
      q: suggestion.composed_prompt,
      destinationTitle: suggestion.title,
    });
    if (startDate) next.set("start", startDate);
    router.push(`/discover?${next.toString()}`);
  }

  if (!hasPrompt) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-20 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-2xl font-semibold">
            Tell us your travel style first.
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Start from the home page so the scout can suggest Thailand clusters.
          </p>
          <Button
            type="button"
            variant="primary"
            className="mt-6"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-pattern-thai" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-50" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Edit prompt
        </button>
        <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-[var(--muted)] sm:inline-flex">
          Destination Scout
        </span>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-20 pt-6 sm:gap-8 sm:pt-10">
        <section className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--saffron)]">
            <Sparkles className="h-3 w-3" />
            Pick a cluster
          </span>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-[var(--foreground)] sm:text-5xl">
            Choose the version of Thailand you want.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]">
            “{stylePrompt}”
          </p>
        </section>

        {startDate && (
          <p className="w-fit rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-[var(--muted-foreground)]">
            Trip starts {startDate}
          </p>
        )}

        {loading && suggestions.length === 0 && (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-center shadow-[var(--shadow-xs)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--saffron)]" />
            <p className="text-sm text-[var(--muted-foreground)]">
              Scouting clusters from curated Hidden Siam gems…
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {suggestions.length > 0 && (
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {suggestions.map((suggestion) => {
              const isRouting = routingId === suggestion.id;
              return (
                <article
                  key={suggestion.id}
                  className="flex min-h-[300px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold leading-tight text-[var(--foreground)]">
                        {suggestion.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                        {suggestion.subtitle}
                      </p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--saffron-tint)] text-[var(--saffron)]">
                      <MapPinned className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
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

                  <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]">
                    {suggestion.why}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {suggestion.avoidance_note}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestion.style_tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto border-t border-[var(--border)] pt-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      Anchor gems
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {suggestion.anchor_gem_ids.slice(0, 4).map((id) => (
                        <span
                          key={id}
                          className="rounded-full bg-[var(--saffron-tint)] px-2.5 py-1 text-xs text-[var(--saffron)]"
                        >
                          {formatGemId(id)}
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      className="mt-4 w-full"
                      disabled={!!routingId}
                      onClick={() => chooseSuggestion(suggestion)}
                    >
                      {isRouting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Compass className="h-4 w-4" />
                      )}
                      Choose this cluster
                      {!isRouting && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
