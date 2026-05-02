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

// Model pick tuned for the 5-min demo. Pro 3.1 timed out at 60s+ even with
// low thinking; Flash 3 preview was also slow on structured output with
// optional fields (Planner schema). Flash Lite 3.1 + minimal thinking lands
// every prompt in <5s per agent.
export const FLASH_LITE_MODEL = google("gemini-3.1-flash-lite-preview");

export const MODELS = {
  destinationScout: FLASH_LITE_MODEL,
  orchestrator: FLASH_LITE_MODEL,
  planner: FLASH_LITE_MODEL,
  listener: FLASH_LITE_MODEL,
  crowdAnalyst: FLASH_LITE_MODEL,
  curator: FLASH_LITE_MODEL,
  verifier: FLASH_LITE_MODEL,
} as const;
