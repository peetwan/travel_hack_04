"use client";

import { motion } from "framer-motion";
import {
  MapPin,
  Star,
  BadgeCheck,
  ExternalLink,
  Sparkles,
  Award,
  Languages,
} from "lucide-react";
import type { WellnessAwardSource, WellnessVenue } from "@/lib/types";

const TYPE_LABEL: Record<WellnessVenue["wellness_type"], string> = {
  spa: "Spa",
  "wellness-resort": "Wellness resort",
  "thai-massage-school": "Massage school",
  "herbal-sauna": "Herbal sauna",
  onsen: "Onsen",
  "yoga-retreat": "Yoga retreat",
  "meditation-retreat": "Meditation",
  "muay-thai-camp": "Muay Thai",
  "traditional-medicine": "Thai medicine",
};

const TYPE_TONE: Record<WellnessVenue["wellness_type"], string> = {
  spa: "border-[var(--jade-soft)] bg-[var(--jade-tint)] text-[var(--jade)]",
  "wellness-resort":
    "border-[var(--gold-soft)] bg-[#fdf6e3] text-[var(--gold)]",
  "thai-massage-school":
    "border-[var(--border-saffron)] bg-[var(--saffron-tint)] text-[var(--saffron)]",
  "herbal-sauna":
    "border-[var(--jade-soft)] bg-[var(--jade-tint)] text-[var(--jade)]",
  onsen: "border-[var(--jade-soft)] bg-[var(--jade-tint)] text-[var(--jade)]",
  "yoga-retreat":
    "border-[var(--gold-soft)] bg-[#fdf6e3] text-[var(--gold)]",
  "meditation-retreat":
    "border-[var(--burgundy-soft)] bg-[#fdf2f2] text-[var(--burgundy)]",
  "muay-thai-camp":
    "border-[var(--burgundy-soft)] bg-[#fdf2f2] text-[var(--burgundy)]",
  "traditional-medicine":
    "border-[var(--border-saffron)] bg-[var(--saffron-tint)] text-[var(--saffron)]",
};

const AWARD_LABEL: Record<WellnessAwardSource, string> = {
  "forbes-travel-guide": "Forbes Travel Guide",
  "conde-nast": "Condé Nast",
  "travel-leisure": "Travel + Leisure",
  "world-spa-awards": "World Spa Awards",
  "michelin-keys": "Michelin Keys",
  tatler: "Tatler",
  "tat-sha": "TAT SHA",
};

export function WellnessCard({
  venue,
  index,
}: {
  venue: WellnessVenue;
  index: number;
}) {
  const heroImage = venue.google_photo_url ?? venue.tat?.thumbnail_url ?? null;
  const topAwards = [...venue.awards]
    .sort((a, b) => b.year - a.year)
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xs)] transition-all hover:border-[var(--jade-soft)] hover:shadow-[var(--shadow-md)]"
    >
      {heroImage && (
        <div className="relative aspect-[16/10] overflow-hidden bg-[var(--surface-soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={venue.name_en}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
          <div className="absolute right-3 top-3">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest backdrop-blur-md ${TYPE_TONE[venue.wellness_type]}`}
            >
              {TYPE_LABEL[venue.wellness_type]}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {venue.sha_tier && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur-md">
                <BadgeCheck className="h-3 w-3" />
                {venue.sha_tier}
              </span>
            )}
            {venue.thai_authenticity >= 5 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                Thai heritage
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-display text-lg font-semibold leading-tight text-[var(--foreground)]">
              {venue.name_en}
            </h3>
            <p className="text-xs text-[var(--muted)]">{venue.name_th}</p>
          </div>
          {!heroImage && (
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${TYPE_TONE[venue.wellness_type]}`}
            >
              {TYPE_LABEL[venue.wellness_type]}
            </span>
          )}
        </div>

        {venue.why ? (
          <p className="border-l-2 border-[var(--jade)] pl-3 text-sm italic leading-relaxed text-[var(--foreground)]">
            {venue.why}
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          {venue.local_character}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-[var(--saffron)]" />
            {venue.province}
          </span>
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-[var(--jade)]" />
            Thai{" "}
            <span className="text-[var(--jade)]">
              {"●".repeat(venue.thai_authenticity)}
            </span>
            <span className="text-[var(--border-strong)]">
              {"●".repeat(5 - venue.thai_authenticity)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[var(--gold)]">
            {venue.price_tier}
          </span>
          {typeof venue.google_rating === "number" && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-[var(--gold)] text-[var(--gold)]" />
              {venue.google_rating.toFixed(1)}
              {typeof venue.google_review_count === "number" && (
                <span className="text-[var(--muted)]">
                  · {venue.google_review_count.toLocaleString()}
                </span>
              )}
            </span>
          )}
        </div>

        {topAwards.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topAwards.map((award, i) => (
              <span
                key={`${award.source}-${award.year}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--gold-soft)] bg-[#fdf6e3] px-2.5 py-0.5 text-[11px] font-medium text-[var(--gold)]"
                title={award.rank ?? AWARD_LABEL[award.source]}
              >
                <Award className="h-3 w-3" />
                {AWARD_LABEL[award.source]}
                <span className="font-mono text-[10px] opacity-70">
                  {award.year}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {venue.signature_treatments.slice(0, 4).map((tag) => (
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
            {venue.languages.length > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">
                <Languages className="h-3 w-3" />
                {venue.languages.slice(0, 4).join(" · ")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {venue.google_maps_uri && (
              <a
                href={venue.google_maps_uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--jade)] transition-colors hover:text-[var(--saffron)]"
                title="Open in Google Maps"
              >
                Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {venue.booking_url && (
              <a
                href={venue.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--saffron)] transition-colors hover:text-[var(--burgundy)]"
                title="Open the official booking page"
              >
                Book
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
