import { NextRequest } from "next/server";
import gemsData from "../../../data/hidden_gems.json";
import type { DestinationSuggestion, HiddenGem } from "@/lib/types";
import {
  buildFallbackDestinationSuggestions,
  normalizeDestinationSuggestions,
  runDestinationScout,
} from "@/lib/agents/runners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const GEMS = gemsData as HiddenGem[];

function validateStartDate(startDate?: string): string | undefined {
  const trimmed = startDate?.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("startDate must be YYYY-MM-DD.");
  }
  const d = new Date(trimmed + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) {
    throw new Error("startDate is not a valid date.");
  }
  return trimmed;
}

function ensureMinimumSuggestions(args: {
  suggestions: DestinationSuggestion[];
  stylePrompt: string;
  startDate?: string;
}): DestinationSuggestion[] {
  if (args.suggestions.length >= 3) return args.suggestions.slice(0, 5);

  const fallback = buildFallbackDestinationSuggestions({
    dataset: GEMS,
    stylePrompt: args.stylePrompt,
    startDate: args.startDate,
    count: 3 - args.suggestions.length,
    excludeSuggestionIds: args.suggestions.map((s) => s.id),
  });

  return [...args.suggestions, ...fallback].slice(0, 5);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { stylePrompt?: string; startDate?: string }
    | null;
  const stylePrompt = body?.stylePrompt?.trim();

  if (!stylePrompt || stylePrompt.length < 4) {
    return Response.json(
      { error: "stylePrompt must be at least 4 characters." },
      { status: 400 }
    );
  }
  if (stylePrompt.length > 500) {
    return Response.json(
      { error: "stylePrompt must be 500 characters or less." },
      { status: 400 }
    );
  }

  let startDate: string | undefined;
  try {
    startDate = validateStartDate(body?.startDate);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid startDate." },
      { status: 400 }
    );
  }

  const scoutOutput = await runDestinationScout({
    stylePrompt,
    startDate,
    dataset: GEMS,
  }).catch((err) => {
    console.warn("[destination-scout] failed, using fallback:", err);
    return null;
  });

  const suggestions = ensureMinimumSuggestions({
    suggestions: normalizeDestinationSuggestions({
      output: scoutOutput,
      dataset: GEMS,
      stylePrompt,
      startDate,
    }),
    stylePrompt,
    startDate,
  });

  if (suggestions.length === 0) {
    return Response.json(
      { error: "No destination suggestions could be generated." },
      { status: 500 }
    );
  }

  return Response.json({ suggestions });
}
