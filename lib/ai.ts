import { createGoogleGenerativeAI } from "@ai-sdk/google";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn(
    "[Hidden Siam] GOOGLE_GENERATIVE_AI_API_KEY is not set — agents will fail at runtime."
  );
}

const google = createGoogleGenerativeAI({
  apiKey: apiKey ?? "",
});

// Model picks tuned for the 5-min demo:
// - Pro 3.1 timed out at 60s+ even with low thinking → too slow for live presentation.
// - Flash 3 preview also too slow on structured output with optional fields (Planner schema).
// - Gemini 2.5 Flash (stable) handles structured output reliably in <5s — keeping it for the agents
//   that emit complex JSON (Curator, Planner). Flash Lite 3.1 stays for retrieval/filter tasks.
export const PRO_MODEL = google("gemini-3.1-pro-preview");
export const FLASH_3_MODEL = google("gemini-3-flash-preview");
export const FLASH_25_MODEL = google("gemini-2.5-flash");
export const FLASH_LITE_MODEL = google("gemini-3.1-flash-lite-preview");

export const MODELS = {
  orchestrator: FLASH_LITE_MODEL,
  planner: FLASH_LITE_MODEL,
  listener: FLASH_LITE_MODEL,
  crowdAnalyst: FLASH_LITE_MODEL,
  curator: FLASH_LITE_MODEL,
  verifier: FLASH_LITE_MODEL,
} as const;
