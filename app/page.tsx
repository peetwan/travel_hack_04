"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
    label: "Wellness reset",
    prompt: "Relaxing wellness trip, Thai spa or onsen, quiet mornings, 4 days.",
  },
  {
    label: "Family nature",
    prompt: "Family-friendly nature, easy walks, wildlife, not too touristy.",
  },
];

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

export default function Home() {
  const router = useRouter();
  const [stylePrompt, setStylePrompt] = useState("");
  const [startDate, setStartDate] = useState<string>(() => defaultStartDate());
  const [submitting, setSubmitting] = useState(false);
  const todayMin = useMemo(() => todayISO(), []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = stylePrompt.trim();
    if (!trimmed) return;

    setSubmitting(true);
    const params = new URLSearchParams({ style: trimmed });
    if (startDate) params.set("start", startDate);
    router.push(`/destinations?${params.toString()}`);
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-pattern-thai" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-60" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-saffron shadow-[var(--shadow-saffron)]">
            <span className="font-display text-base font-bold text-white">H</span>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Hidden Siam
          </span>
        </div>
        <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs text-[var(--muted)] sm:inline-flex">
          Scout first · route next
        </span>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-6 px-5 pb-16 pt-0 text-center sm:gap-12 sm:px-6 sm:pb-20 sm:pt-14">
        <div className="flex min-h-[calc(100svh-88px)] w-full flex-col items-center justify-center gap-7 pb-8 sm:min-h-0 sm:gap-10 sm:pb-0">
          <section className="flex max-w-xl flex-col items-center gap-3 sm:max-w-2xl sm:gap-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-3 py-1 text-xs font-medium uppercase tracking-widest text-[var(--saffron)]">
              <Sparkles className="h-3 w-3" />
              Built against overtourism
            </span>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-7xl">
              Find the other Thailand.
            </h1>
            <p className="max-w-md text-balance text-base leading-relaxed text-[var(--muted-foreground)] sm:max-w-xl sm:text-lg">
              Start with how you want to travel. We will scout a few Thailand
              clusters before the agents build the route.
            </p>
          </section>

          <section className="w-full max-w-3xl">
            <div className="absolute -z-10 hidden rounded-[2.5rem] bg-gradient-to-br from-[var(--saffron-tint)] via-transparent to-[var(--jade-tint)] blur-2xl opacity-70 sm:block" />
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-lg)]"
            >
              <Textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Peaceful beaches, no party scene, good seafood, 5 days."
                disabled={submitting}
                className="min-h-[112px] border-0 bg-transparent text-base shadow-none focus:ring-0"
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
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={submitting}
                      className="bg-transparent text-sm text-[var(--foreground)] outline-none"
                    />
                  </span>
                </label>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !stylePrompt.trim()}
                  className="sm:min-w-[220px]"
                >
                  {submitting ? (
                    <>
                      <Compass className="h-4 w-4 animate-pulse" />
                      Scouting…
                    </>
                  ) : (
                    <>
                      Scout destinations
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <section className="grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setStylePrompt(ex.prompt)}
              disabled={submitting}
              className="group flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-all hover:border-[var(--border-saffron)] hover:bg-[var(--saffron-tint)] hover:shadow-[var(--shadow-sm)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-display text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--saffron)]">
                {ex.label}
              </span>
              <span className="text-xs leading-relaxed text-[var(--muted-foreground)]">
                {ex.prompt}
              </span>
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
