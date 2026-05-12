import {
  APIConnectionError as AnthropicConnectionError,
  APIConnectionTimeoutError as AnthropicConnectionTimeoutError,
  APIError as AnthropicAPIError,
  AuthenticationError as AnthropicAuthenticationError,
  BadRequestError as AnthropicBadRequestError,
  NotFoundError as AnthropicNotFoundError,
  PermissionDeniedError as AnthropicPermissionDeniedError,
  RateLimitError as AnthropicRateLimitError,
} from "@anthropic-ai/sdk";
import {
  APIConnectionError as OpenAIConnectionError,
  APIConnectionTimeoutError as OpenAIConnectionTimeoutError,
  APIError as OpenAIAPIError,
  AuthenticationError as OpenAIAuthenticationError,
  BadRequestError as OpenAIBadRequestError,
  InternalServerError as OpenAIInternalServerError,
  NotFoundError as OpenAINotFoundError,
  PermissionDeniedError as OpenAIPermissionDeniedError,
  RateLimitError as OpenAIRateLimitError,
  UnprocessableEntityError as OpenAIUnprocessableEntityError,
} from "openai";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateResumeStructured } from "@/lib/server/llm-generate";
import { generateResumeRequestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MAX_BODY_BYTES = 524288;

function anthropicDetail(err: AnthropicAPIError): string | null {
  const raw = err.error as unknown;
  if (raw && typeof raw === "object" && "error" in raw) {
    const inner = (raw as { error?: unknown }).error;
    if (inner && typeof inner === "object" && "message" in inner) {
      const m = (inner as { message?: unknown }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return null;
}

function openAIDetail(err: OpenAIAPIError): string | null {
  const raw = err.error as unknown;
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return null;
}

function mapAnthropicToResponse(err: unknown): NextResponse | null {
  if (err instanceof AnthropicAuthenticationError) {
    return NextResponse.json(
      {
        detail:
          "Anthropic rejected the API key (401). Set ANTHROPIC_API_KEY in Vercel env with no extra spaces.",
      },
      { status: 503 },
    );
  }
  if (err instanceof AnthropicPermissionDeniedError) {
    return NextResponse.json(
      {
        detail:
          "Anthropic denied access (403). Check account permissions for this model.",
      },
      { status: 503 },
    );
  }
  if (err instanceof AnthropicNotFoundError) {
    const hint =
      anthropicDetail(err) ??
      "Model or endpoint not found (404). Try anthropic_model or ANTHROPIC_MODEL (e.g. claude-sonnet-4-20250514).";
    return NextResponse.json({ detail: hint }, { status: 503 });
  }
  if (err instanceof AnthropicRateLimitError) {
    return NextResponse.json(
      { detail: "Anthropic rate limit exceeded. Retry shortly." },
      { status: 429 },
    );
  }
  if (err instanceof AnthropicBadRequestError) {
    const hint = anthropicDetail(err) ?? "Invalid request to Anthropic API (400).";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  if (err instanceof AnthropicConnectionTimeoutError) {
    return NextResponse.json(
      { detail: "Anthropic request timed out." },
      { status: 504 },
    );
  }
  if (err instanceof AnthropicConnectionError) {
    return NextResponse.json(
      { detail: "Could not reach Anthropic API. Check network and DNS." },
      { status: 503 },
    );
  }
  if (err instanceof AnthropicAPIError) {
    const hint =
      anthropicDetail(err) ?? "AI service error. Check logs and API configuration.";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  return null;
}

function mapOpenAIToResponse(err: unknown): NextResponse | null {
  if (err instanceof OpenAIAuthenticationError) {
    return NextResponse.json(
      {
        detail:
          "OpenAI rejected the API key (401). Set OPENAI_API_KEY in Vercel env with no extra spaces.",
      },
      { status: 503 },
    );
  }
  if (err instanceof OpenAIPermissionDeniedError) {
    return NextResponse.json(
      {
        detail:
          "OpenAI denied access (403). Check account permissions for this model.",
      },
      { status: 503 },
    );
  }
  if (err instanceof OpenAINotFoundError) {
    const hint =
      openAIDetail(err) ??
      "OpenAI model or endpoint not found (404). Try llm_model or OPENAI_MODEL (e.g. gpt-4.1).";
    return NextResponse.json({ detail: hint }, { status: 503 });
  }
  if (err instanceof OpenAIRateLimitError) {
    return NextResponse.json(
      { detail: "OpenAI rate limit exceeded. Retry shortly." },
      { status: 429 },
    );
  }
  if (err instanceof OpenAIBadRequestError) {
    const hint = openAIDetail(err) ?? "Invalid request to OpenAI API (400).";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  if (err instanceof OpenAIUnprocessableEntityError) {
    const hint =
      openAIDetail(err) ??
      "OpenAI rejected the request body or parameters (422). Check model id and token limits.";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  if (err instanceof OpenAIInternalServerError) {
    const hint = openAIDetail(err) ?? "OpenAI returned an internal error. Retry shortly.";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  if (err instanceof OpenAIConnectionTimeoutError) {
    return NextResponse.json(
      { detail: "OpenAI request timed out." },
      { status: 504 },
    );
  }
  if (err instanceof OpenAIConnectionError) {
    return NextResponse.json(
      { detail: "Could not reach OpenAI API. Check network and DNS." },
      { status: 503 },
    );
  }
  if (err instanceof OpenAIAPIError) {
    const hint =
      openAIDetail(err) ?? "OpenAI service error. Check logs and API configuration.";
    return NextResponse.json({ detail: hint }, { status: 502 });
  }
  return null;
}

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
    body = generateResumeRequestSchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.message }, { status: 422 });
    }
    throw e;
  }

  try {
    // LLMs return resume JSON only (structured text).
    const { resume, generationMeta } = await generateResumeStructured(body);
    return NextResponse.json({
      resume,
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

    console.error("generate-resume error", err);
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim().slice(0, 800)
        : "Resume generation failed. Try again or shorten inputs.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
