import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateCoverLetterStructured } from "@/lib/server/cover-letter-generate";
import {
  mapAnthropicToResponse,
  mapOpenAIToResponse,
} from "@/lib/server/llm-http-errors";
import { generateCoverLetterRequestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MAX_BODY_BYTES = 524288;

export async function POST(request: Request): Promise<NextResponse> {
  const maxBody = Number(
    process.env.MAX_BODY_BYTES ?? String(DEFAULT_MAX_BODY_BYTES),
  );
  const cl = request.headers.get("content-length");
  if (cl && /^\d+$/.test(cl) && Number(cl) > maxBody) {
    return NextResponse.json({ detail: "Request body too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let body;
  try {
    body = generateCoverLetterRequestSchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.message }, { status: 422 });
    }
    throw e;
  }

  try {
    const { letter, generationMeta } = await generateCoverLetterStructured(body);
    return NextResponse.json({
      letter,
      generation_meta: generationMeta,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ detail: err.message }, { status: 422 });
    }
    if (
      err instanceof Error &&
      (err.message === "ANTHROPIC_API_KEY is not set" ||
        err.message === "OPENAI_API_KEY is not set")
    ) {
      return NextResponse.json({ detail: err.message }, { status: 503 });
    }

    const mappedAnthropic = mapAnthropicToResponse(err);
    if (mappedAnthropic) return mappedAnthropic;

    const mappedOpenAI = mapOpenAIToResponse(err);
    if (mappedOpenAI) return mappedOpenAI;

    if (err instanceof Error && err.message === "Model returned non-JSON output") {
      return NextResponse.json({ detail: err.message }, { status: 502 });
    }

    if (err instanceof SyntaxError) {
      return NextResponse.json({ detail: "Model returned non-JSON output" }, { status: 502 });
    }

    console.error("generate-cover-letter error", err);
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim().slice(0, 800)
        : "Cover letter generation failed. Try again or shorten inputs.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
