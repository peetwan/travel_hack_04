"use client";

import { motion } from "framer-motion";
import { MapPin, Star, BadgeCheck, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HiddenGem, MapsCrowdSignal } from "@/lib/types";

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

export function GemCard({
  gem,
  index,
  crowdSignal,
}: {
  gem: HiddenGem;
  index: number;
  crowdSignal?: MapsCrowdSignal;
}) {
  const hasTat = !!gem.tat;
  const heroImage = gem.tat?.thumbnail_url ?? null;
  const mapsReviews = crowdSignal?.matched_place?.user_rating_count;
  const mapsUri = crowdSignal?.matched_place?.google_maps_uri;
  const mapsPressure = crowdSignal?.pressure;
  const pressureTone =
    mapsPressure === "high"
      ? "border-[var(--burgundy-soft)] bg-[#fdf2f2] text-[var(--burgundy)]"
      : mapsPressure === "medium"
        ? "border-[var(--gold-soft)] bg-[#fdf6e3] text-[var(--gold)]"
        : mapsPressure === "low"
          ? "border-[var(--jade-soft)] bg-[var(--jade-tint)] text-[var(--jade)]"
          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]";

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
          {crowdSignal && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${pressureTone}`}
              title={
                crowdSignal.reasons[0] ??
                "Google Maps popularity proxy, not a live crowd counter."
              }
            >
              <Users className="h-3 w-3" />
              Maps {mapsPressure ?? "unknown"}
            </span>
          )}
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
          <div className="flex flex-col gap-0.5">
            <span>
              Best:{" "}
              <span className="text-[var(--foreground)]">{gem.best_time}</span>
            </span>
            {mapsReviews && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                {mapsReviews.toLocaleString()} Google reviews
                {typeof crowdSignal?.matched_place?.open_now === "boolean"
                  ? crowdSignal.matched_place.open_now
                    ? " · open now"
                    : " · not open now"
                  : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {mapsUri && (
              <a
                href={mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--jade)] transition-colors hover:text-[var(--saffron)]"
                title="Open matched place in Google Maps"
              >
                Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {gem.tat?.detail_url && (
              <a
                href={gem.tat.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--saffron)] transition-colors hover:text-[var(--burgundy)]"
                title="Open in TAT (Tourism Authority of Thailand) database"
              >
                TAT
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
