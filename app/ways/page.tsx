"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Way = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  themes: string[];
  refinement: string;
};

const ACCENTS = [
  {
    border: "border-t-[var(--saffron)]",
    chip: "bg-[var(--saffron-tint)] text-[var(--saffron)]",
    tag: "bg-[var(--saffron-soft)]/40 text-[var(--saffron)]",
    glow: "hover:shadow-[0_8px_32px_-4px_var(--saffron-soft)]",
    btn: "hover:bg-[var(--saffron-tint)] hover:text-[var(--saffron)] hover:border-[var(--border-saffron)]",
    number: "text-[var(--saffron)]",
  },
  {
    border: "border-t-[var(--jade)]",
    chip: "bg-[var(--jade-tint)] text-[var(--jade)]",
    tag: "bg-[var(--jade-soft)]/40 text-[var(--jade)]",
    glow: "hover:shadow-[0_8px_32px_-4px_var(--jade-soft)]",
    btn: "hover:bg-[var(--jade-tint)] hover:text-[var(--jade)] hover:border-[color:var(--jade-soft)]",
    number: "text-[var(--jade)]",
  },
  {
    border: "border-t-[var(--burgundy)]",
    chip: "bg-[var(--burgundy-soft)]/30 text-[var(--burgundy)]",
    tag: "bg-[var(--burgundy-soft)]/40 text-[var(--burgundy)]",
    glow: "hover:shadow-[0_8px_32px_-4px_var(--burgundy-soft)]",
    btn: "hover:bg-[var(--burgundy-soft)]/20 hover:text-[var(--burgundy)] hover:border-[var(--burgundy-soft)]",
    number: "text-[var(--burgundy)]",
  },
  {
    border: "border-t-[var(--gold)]",
    chip: "bg-[var(--gold-soft)]/30 text-[var(--gold)]",
    tag: "bg-[var(--gold-soft)]/40 text-[var(--gold)]",
    glow: "hover:shadow-[0_8px_32px_-4px_var(--gold-soft)]",
    btn: "hover:bg-[var(--gold-soft)]/20 hover:text-[var(--gold)] hover:border-[var(--gold-soft)]",
    number: "text-[var(--gold)]",
  },
] as const;

export default function WaysPage() {
  return (
    <Suspense fallback={<WaysFallback />}>
      <WaysInner />
    </Suspense>
  );
}

function WaysFallback() {
  return (
    <main className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
      Loading…
    </main>
  );
}

function WaysInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prompt = params.get("q") ?? "";
  const startDate = params.get("start") ?? "";

  const [ways, setWays] = useState<Way[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    if (!prompt) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/ways", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, startDate: startDate || undefined }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setWays(data.ways ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not generate paths. Try again or go directly.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [prompt, startDate, router]);

  function choose(way: Way) {
    setChoosing(way.id);
    const p = new URLSearchParams({ q: prompt, refinement: way.refinement });
    if (startDate) p.set("start", startDate);
    router.push(`/discover?${p.toString()}`);
  }

  function skipToDiscover() {
    const p = new URLSearchParams({ q: prompt });
    if (startDate) p.set("start", startDate);
    router.push(`/discover?${p.toString()}`);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-pattern-thai" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-60" />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-saffron shadow-[var(--shadow-saffron)]">
              <span className="font-display text-base font-bold text-white">H</span>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Hidden Siam
            </span>
          </Link>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--border-saffron)] hover:text-[var(--saffron)]"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 pb-24 pt-6">
        {/* Hero */}
        <section className="flex flex-col gap-4">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--saffron)]">
            <Sparkles className="h-3 w-3" />
            Choose your path
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-5xl">
            How do you want to travel?
          </h1>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Your brief
            </span>
            <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted-foreground)] italic">
              &ldquo;{prompt}&rdquo;
            </p>
          </div>
        </section>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={skipToDiscover} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ways.map((way, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const isChoosing = choosing === way.id;
              const isDisabled = choosing !== null && !isChoosing;
              return (
                <button
                  key={way.id}
                  onClick={() => choose(way)}
                  disabled={choosing !== null}
                  className={[
                    "group relative flex flex-col gap-4 rounded-3xl border-t-4 border border-[var(--border)] bg-[var(--surface)] p-6 text-left",
                    "transition-all duration-200",
                    accent.border,
                    accent.glow,
                    isChoosing
                      ? "scale-[0.98] opacity-80"
                      : "hover:scale-[1.01] hover:shadow-[var(--shadow-md)]",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  {/* Card top row */}
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest",
                        accent.chip,
                      ].join(" ")}
                    >
                      Path {String(i + 1).padStart(2, "0")}
                    </span>
                    {isChoosing && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] animate-pulse">
                        Routing…
                      </span>
                    )}
                  </div>

                  {/* Title + tagline */}
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-xl font-semibold leading-snug text-[var(--foreground)]">
                      {way.title}
                    </h2>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">
                      {way.tagline}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {way.description}
                  </p>

                  {/* Theme chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {way.themes.map((theme) => (
                      <span
                        key={theme}
                        className={[
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          accent.tag,
                        ].join(" ")}
                      >
                        {theme}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  <div
                    className={[
                      "mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors",
                      accent.btn,
                    ].join(" ")}
                  >
                    {isChoosing ? "Opening…" : "Explore this path"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Skip link */}
        {!loading && !error && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
            <span>Not what you had in mind?</span>
            <button
              onClick={skipToDiscover}
              className="underline underline-offset-2 hover:text-[var(--saffron)] transition-colors"
            >
              Let the agents decide
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--saffron)]" />
        Mapping your paths…
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 h-56"
          >
            <div className="flex flex-col gap-3">
              <div className="h-5 w-16 rounded-full bg-[var(--border)]" />
              <div className="h-6 w-3/4 rounded-lg bg-[var(--border)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--border)]" />
              <div className="h-12 w-full rounded-lg bg-[var(--border)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Go straight to the agents
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
