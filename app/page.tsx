"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { CalendarDays, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  {
    label: "Slow nature, no crowds",
    prompt:
      "3 days in Chiang Mai. I love nature, hate crowds, vegan-friendly.",
  },
  {
    label: "Bangkok weekend reset",
    prompt:
      "Weekend escape from Bangkok — peaceful, no tourist traps, good food.",
  },
  {
    label: "Phi Phi alternative",
    prompt:
      "An alternative to Phi Phi for a week. Clear water, no jet skis, sunsets.",
  },
  {
    label: "Temples, not Bangkok",
    prompt:
      "10 days exploring temples and culture, but not the Bangkok rush.",
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
  const [prompt, setPrompt] = useState("");
  const [startDate, setStartDate] = useState<string>(() => defaultStartDate());
  const [submitting, setSubmitting] = useState(false);
  const todayMin = useMemo(() => todayISO(), []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSubmitting(true);
    const params = new URLSearchParams({ q: prompt.trim() });
    if (startDate) params.set("start", startDate);
    router.push(`/discover?${params.toString()}`);
  }

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
            7 agents · live web · TAT verified
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
            Travel.
          </h1>
          <p className="max-w-xl text-balance text-lg leading-relaxed text-[var(--muted-foreground)]">
            Seven specialised AI agents collaborate to surface authentic Thai
            destinations the famous travel bots never recommend. Tell us how
            you want to travel — they argue, filter, and route the rest.
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
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 3 days in Chiang Mai. I love nature, hate crowds, vegan-friendly."
              disabled={submitting}
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
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={submitting}
                    className="bg-transparent text-sm text-[var(--foreground)] outline-none"
                  />
                </span>
              </label>
              <Button
                type="submit"
                size="lg"
                disabled={submitting || !prompt.trim()}
                className="sm:min-w-[220px]"
              >
                {submitting ? "Routing…" : "Send to the agents"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </form>

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
                  onClick={() => setPrompt(ex.prompt)}
                  className="group flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-all hover:border-[var(--border-saffron)] hover:bg-[var(--saffron-tint)] hover:shadow-[var(--shadow-sm)]"
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
