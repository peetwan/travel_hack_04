import { z } from "zod";

export const userQuerySchema = z.object({
  prompt: z.string().min(1).max(500),
});

export const listenerOutputSchema = z.object({
  narration: z
    .string()
    .describe("One-sentence first-person message about what you found."),
  candidate_ids: z
    .array(z.string())
    .min(1)
    .max(15)
    .describe("Hidden gem IDs that loosely match the user prompt."),
  reasoning: z
    .string()
    .describe("Concise reasoning (<=2 sentences)."),
});
export type ListenerOutput = z.infer<typeof listenerOutputSchema>;

export const crowdAnalystOutputSchema = z.object({
  narration: z.string(),
  filtered_ids: z.array(z.string()).min(0).max(15),
  warned_traps: z
    .array(z.string())
    .describe("Tourist trap IDs the user might be heading toward."),
  candidate_assessments: z
    .array(
      z.object({
        id: z.string(),
        crowd_pressure: z.enum(["low", "medium", "high", "unknown"]),
        action: z.enum(["keep", "caution", "drop"]),
        reason: z.string().describe("One short sentence grounded in dataset or Maps signals."),
      })
    )
    .max(15)
    .optional(),
  reasoning: z.string(),
});
export type CrowdAnalystOutput = z.infer<typeof crowdAnalystOutputSchema>;

export const curatorOutputSchema = z.object({
  narration: z.string(),
  scored: z
    .array(
      z.object({
        id: z.string(),
        score: z.number().min(0).max(1),
        why: z.string().describe("One short sentence."),
      })
    )
    .min(0)
    .max(15),
  reasoning: z.string(),
});
export type CuratorOutput = z.infer<typeof curatorOutputSchema>;

export const plannerOutputSchema = z.object({
  narration: z.string(),
  selected_ids: z.array(z.string()).min(1).max(6),
  stays: z
    .array(
      z.object({
        gem_id: z.string(),
        nights: z.number().int().min(1).max(14),
        why_this_base: z.string().describe("One short sentence."),
      })
    )
    .min(1)
    .max(3),
  days: z
    .array(
      z.object({
        day: z.number().int().min(1).max(14),
        title: z.string(),
        stay_at: z
          .string()
          .describe("gem_id of the base the user sleeps near that night."),
        is_transfer_day: z.boolean().default(false),
        morning: z.string().optional(),
        afternoon: z.string().optional(),
        evening: z.string().optional(),
        gems: z.array(z.string()),
      })
    )
    .optional(),
  reasoning: z.string(),
});
export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

export const verifierOutputSchema = z.object({
  narration: z.string(),
  warnings: z.array(z.string()),
  tips: z.array(z.string()).max(5),
  is_valid: z.boolean(),
});
export type VerifierOutput = z.infer<typeof verifierOutputSchema>;

export const weatherWatcherOutputSchema = z.object({
  narration: z
    .string()
    .describe("First-person sentence summarizing the weather outlook."),
  per_day_advice: z
    .array(
      z.object({
        day: z.number().int().min(1).max(14),
        advice: z
          .string()
          .describe(
            "One short sentence: how to play this day given the forecast. E.g. 'Rainy — flip the morning hike with the temple visit.'"
          ),
      })
    )
    .max(14),
  best_day_for_outdoor: z
    .number()
    .int()
    .min(1)
    .max(14)
    .nullable()
    .describe("Day number with the best forecast for outdoor activity, or null if uniform."),
  reasoning: z.string(),
});
export type WeatherWatcherOutput = z.infer<typeof weatherWatcherOutputSchema>;

export const wellnessPulseOutputSchema = z.object({
  narration: z
    .string()
    .describe("First-person sentence summarising the wellness picks (English)."),
  picks: z
    .array(
      z.object({
        id: z
          .string()
          .describe("Wellness venue id from the curated dataset (must match)."),
        why: z
          .string()
          .describe(
            "One short sentence on why this fits the user's prompt — refer to a specific signature treatment, Thai-character detail, or award."
          ),
        luxury_signals: z
          .array(z.string())
          .max(3)
          .describe(
            "Up to 3 short labels: SHA Plus, Forbes 5-star, Lanna heritage, Royal Thai medicine, etc."
          ),
      })
    )
    .min(0)
    .max(5),
  reasoning: z.string(),
});
export type WellnessPulseOutput = z.infer<typeof wellnessPulseOutputSchema>;

export const webPulseOutputSchema = z.object({
  narration: z
    .string()
    .describe("First-person sentence about what the live web showed."),
  validations: z
    .array(
      z.object({
        gem_id: z.string(),
        verdict: z.enum(["supports", "contradicts", "neutral"]),
        quote: z.string().describe("Short paraphrase from the web hit (<= 240 chars)."),
        source_url: z.string(),
        source_published_at: z.string().optional(),
        evidence_level: z.enum(["search-snippet", "page-scrape"]).optional(),
      })
    )
    .max(10),
  discovered_gems: z
    .array(
      z.object({
        name_en: z
          .string()
          .describe("English name of the place — must be a real, locatable destination."),
        name_th: z.string().optional(),
        province: z
          .string()
          .describe("Thai province the place is in (English spelling, e.g. 'Mae Hong Son')."),
        why: z
          .string()
          .describe("One sentence on why this fits the user's prompt, grounded in the hit."),
        source_url: z.string(),
        source_published_at: z.string().optional(),
      })
    )
    .max(5)
    .optional()
    .describe(
      "NEW places found in the live web hits that are NOT in the candidate set. Only propose places clearly named in a Thai-source hit. Max 5."
    ),
  reasoning: z.string(),
});
export type WebPulseOutput = z.infer<typeof webPulseOutputSchema>;
