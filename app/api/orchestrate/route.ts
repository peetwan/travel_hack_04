import { NextRequest } from "next/server";
import { orchestrate } from "@/lib/agents/orchestrator";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const encoder = new TextEncoder();

function sseFrame(event: AgentEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { prompt?: string; startDate?: string }
    | null;
  const prompt = body?.prompt?.trim();
  const startDate = body?.startDate?.trim();

  if (!prompt || prompt.length < 4) {
    return new Response(
      JSON.stringify({ error: "Prompt must be at least 4 characters." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate startDate if provided: must be YYYY-MM-DD and a real future date.
  let startISO: string | undefined;
  if (startDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return new Response(
        JSON.stringify({ error: "startDate must be YYYY-MM-DD." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const d = new Date(startDate + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) {
      return new Response(
        JSON.stringify({ error: "startDate is not a valid date." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    startISO = startDate;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(sseFrame(e));
        } catch {
          // controller already closed
        }
      };
      try {
        await orchestrate(prompt, emit, { startDate: startISO });
      } catch (err) {
        emit({
          type: "error",
          message:
            err instanceof Error ? err.message : "Unknown orchestration error.",
          timestamp: Date.now(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
