import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { FLASH_LITE_MODEL } from "@/lib/ai";

const waySchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  themes: z.array(z.string()).min(2).max(3),
  refinement: z.string(),
});

const waysOutputSchema = z.object({
  ways: z.array(waySchema).min(3).max(4),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.prompt || String(body.prompt).trim().length < 4) {
    return NextResponse.json({ error: "Prompt too short" }, { status: 400 });
  }

  const prompt = String(body.prompt).trim();
  const startDate = body.startDate ? String(body.startDate) : "flexible";

  const { object } = await generateObject({
    model: FLASH_LITE_MODEL,
    schema: waysOutputSchema,
    prompt: `You are a Thailand travel specialist focused on authentic, anti-overtourism experiences.

The user said: "${prompt}"
Trip start: ${startDate}

Generate exactly 3 to 4 meaningfully distinct travel paths for this trip. Each path represents a different travel philosophy — not just variations of the same idea.

Good contrasts (pick the ones that fit this trip): wild nature escape vs cultural immersion vs wellness/slow retreat vs active adventure vs local food journey vs river/canal heritage.
The paths must feel genuinely different. Never create two paths with the same primary focus.
Each path must be realistic for Thailand and stay true to the spirit of the user's original request.

Return a "ways" array where each item has:
- id: short kebab-case (e.g. "forest-immersion", "temple-circuits")
- title: 3–5 words, punchy, no generic travel words like "journey" or "adventure"
- tagline: one evocative line, under 12 words
- description: 1–2 specific sentences explaining what this path prioritises and how it differs
- themes: 2–3 short tags (e.g. "forest trails", "temple circuits", "slow food", "river villages")
- refinement: one concrete instruction sentence appended to the user's prompt to steer the agents (be specific, e.g. "Prioritise forested highland valleys and river routes; avoid coastal towns entirely" or "Focus on traditional craft villages and artisan homestays over resort infrastructure")`,
  });

  return NextResponse.json(object);
}
