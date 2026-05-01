"use client";

import { motion } from "framer-motion";
import { MapPin, Star, BadgeCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HiddenGem } from "@/lib/types";

const CATEGORY_LABEL: Record<HiddenGem["category"], string> = {
  nature: "Nature",
  temple: "Temple",
  food: "Food",
  culture: "Culture",
  adventure: "Adventure",
  beach: "Beach",
  village: "Village",
};

const CATEGORY_VARIANT: Record<
  HiddenGem["category"],
  "saffron" | "jade" | "burgundy" | "gold"
> = {
  nature: "jade",
  temple: "gold",
  food: "saffron",
  culture: "burgundy",
  adventure: "saffron",
  beach: "jade",
  village: "gold",
};

export function GemCard({ gem, index }: { gem: HiddenGem; index: number }) {
  const hasTat = !!gem.tat;
  const heroImage = gem.tat?.thumbnail_url ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-all hover:border-[var(--border-saffron)] hover:shadow-[var(--shadow-md)]"
    >
      {heroImage && (
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={gem.name_en}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {hasTat && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur-md">
                <BadgeCheck className="h-3 w-3" />
                TAT verified
              </span>
            )}
            {gem.tat?.sha_certified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur-md">
                SHA
              </span>
            )}
          </div>
          <div className="absolute right-3 top-3">
            <Badge variant={CATEGORY_VARIANT[gem.category]} className="capitalize backdrop-blur-md">
              {CATEGORY_LABEL[gem.category]}
            </Badge>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-display text-lg font-semibold leading-tight text-[var(--foreground)]">
              {gem.name_en}
            </h3>
            <p className="text-xs text-[var(--muted)]">{gem.name_th}</p>
          </div>
          {!heroImage && (
            <Badge variant={CATEGORY_VARIANT[gem.category]} className="shrink-0 capitalize">
              {CATEGORY_LABEL[gem.category]}
            </Badge>
          )}
        </div>

        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          {gem.en_description}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-[var(--saffron)]" />
            {gem.province}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-[var(--gold)] text-[var(--gold)]" />
            Auth {gem.auth_score}/5
          </span>
          <span>
            <span className="text-[var(--burgundy)]">
              {"●".repeat(gem.crowd_level)}
            </span>
            <span className="text-[var(--border-strong)]">
              {"●".repeat(5 - gem.crowd_level)}
            </span>
            <span className="ml-1 text-[var(--muted)]">crowd</span>
          </span>
          {hasTat && !heroImage && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-saffron)] bg-[var(--saffron-tint)] px-2 py-0.5 font-medium uppercase tracking-widest text-[var(--saffron)]">
              <BadgeCheck className="h-3 w-3" />
              TAT
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {gem.vibe_tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-0.5 text-[11px] text-[var(--muted-foreground)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
          <span>
            Best:{" "}
            <span className="text-[var(--foreground)]">{gem.best_time}</span>
          </span>
          {gem.tat?.detail_url && (
            <a
              href={gem.tat.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--saffron)] transition-colors hover:text-[var(--burgundy)]"
              title="Open in TAT (Tourism Authority of Thailand) database"
            >
              TAT page
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
