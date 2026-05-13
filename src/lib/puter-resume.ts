import type { CoverLetterPayload, GeneratePayload, LlmProvider } from "@/lib/api";
import type { GenerateCoverLetterResponse, GenerateResumeResponse } from "@/lib/types";
import {
  buildUserPayload,
  JSON_OBJECT_ONLY_FOOTER,
  STATIC_TAILOR_INSTRUCTIONS,
} from "@/lib/server/resume-prompt";
import {
  buildCoverLetterUserPayload,
  COVER_LETTER_JSON_FOOTER,
  STATIC_COVER_LETTER_INSTRUCTIONS,
} from "@/lib/server/cover-letter-prompt";
import { parseCoverLetterJsonValue } from "@/lib/cover-letter-parse";
import { parseTailoredGenerationFromLlm } from "@/lib/server/tailored-output-parse";
import {
  type GenerateResumeRequestParsed,
  generateCoverLetterRequestSchema,
} from "@/lib/server/schemas";
import { ZodError } from "zod";

function abbrevZodIssues(e: ZodError, maxIssues = 3): string {
  return e.issues
    .slice(0, maxIssues)
    .map((i) => {
      const p = i.path.length ? i.path.join(".") : "(root)";
      return `${p}: ${i.message}`;
    })
    .join("; ");
}

const PUTER_OPENAI_FALLBACK = "gpt-5.4-nano";

/** Map Anthropic API-style ids to Puter [model names](https://developer.puter.com/tutorials/free-unlimited-claude-35-sonnet-api/). */
const ANTHROPIC_TO_PUTER: Record<string, string> = {
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-sonnet-4-20250514": "claude-sonnet-4-6",
  "claude-opus-4-20250514": "claude-opus-4-6",
  "claude-opus-4-6-fast": "claude-opus-4.6-fast",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5",
};

function resolvePuterAnthropicModel(modelId: string): string {
  const m = modelId.trim();
  if (m && ANTHROPIC_TO_PUTER[m]) return ANTHROPIC_TO_PUTER[m];
  const low = m.toLowerCase();
  if (low.includes("haiku")) return "claude-haiku-4-5";
  if (low.includes("opus") && low.includes("fast")) return "claude-opus-4.6-fast";
  if (low.includes("opus")) return "claude-opus-4-7";
  if (low.includes("sonnet")) return "claude-sonnet-4-6";
  return "claude-sonnet-4-6";
}

/** Prefer Puter-listed OpenAI ids; otherwise fall back (see [OpenAI via Puter](https://developer.puter.com/tutorials/free-unlimited-openai-api/)). */
function resolvePuterOpenAIModel(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return PUTER_OPENAI_FALLBACK;
  const low = trimmed.toLowerCase();
  if (/^gpt-|^o[0-9]/.test(low) || low.startsWith("openai/")) return trimmed;
  return PUTER_OPENAI_FALLBACK;
}

export function resolvePuterModel(provider: LlmProvider, llmModel: string): string {
  const id =
    llmModel.trim() ||
    (provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4.1");
  return provider === "anthropic"
    ? resolvePuterAnthropicModel(id)
    : resolvePuterOpenAIModel(id);
}

export function resolvePuterRoute(body: GenerateResumeRequestParsed): {
  provider: LlmProvider;
  model: string;
} {
  const explicit = body.llm_provider;
  const llmModel = body.llm_model?.trim();
  const anth = body.anthropic_model?.trim();
  if (explicit === "openai") {
    return { provider: "openai", model: llmModel || "gpt-4.1" };
  }
  if (explicit === "anthropic") {
    return {
      provider: "anthropic",
      model: llmModel || anth || "claude-sonnet-4-6",
    };
  }
  if (anth) {
    return { provider: "anthropic", model: anth };
  }
  return { provider: "openai", model: llmModel || "gpt-4.1" };
}

function payloadToParsed(payload: GeneratePayload): GenerateResumeRequestParsed {
  return {
    system_prompt: payload.system_prompt,
    job_description: payload.job_description,
    source_resume: payload.source_resume,
    display_name: payload.display_name.trim(),
    email: payload.email.trim(),
    phone: payload.phone?.trim() || undefined,
    address: payload.address?.trim() || undefined,
    linkedin: payload.linkedin?.trim() || undefined,
    llm_provider: payload.llm_provider,
    llm_model: payload.llm_model?.trim() || undefined,
    anthropic_model: payload.anthropic_model?.trim() || undefined,
    anthropic_max_tokens: payload.anthropic_max_tokens ?? undefined,
    claude_output_effort: payload.claude_output_effort?.trim() || undefined,
    pdf_template: payload.pdf_template ?? "classic",
  };
}

function extractFirstJsonFenceBody(raw: string): string | null {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  return m ? m[1].trim() : null;
}

/** Parse model text that may include prose or markdown fences. */
function coerceToJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = extractFirstJsonFenceBody(trimmed);
  const attempts: string[] = [];
  if (fenced) attempts.push(fenced);
  attempts.push(trimmed);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) attempts.push(trimmed.slice(start, end + 1));

  for (const s of attempts) {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      /* try next candidate */
    }
  }
  throw new Error("Model returned non-JSON output");
}

function messageContentToString(content: unknown): string | null {
  if (typeof content === "string") {
    const t = content.trim();
    return t !== "" ? t : null;
  }
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") {
      const t = o.text.trim();
      return t !== "" ? t : null;
    }
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (block && typeof block === "object") {
        const o = block as Record<string, unknown>;
        if (typeof o.text === "string" && o.text.trim() !== "") parts.push(o.text);
      }
    }
    const joined = parts.join("").trim();
    return joined !== "" ? joined : null;
  }
  return null;
}

function extractTextFromPuterResponse(response: unknown): string {
  if (
    response != null &&
    typeof response === "object" &&
    Symbol.asyncIterator in response
  ) {
    throw new Error(
      "Puter returned a streaming response. Use non-streaming chat or turn off free mode.",
    );
  }
  if (typeof response === "string") {
    const s = response.trim();
    if (s !== "") return s;
    throw new Error("Puter returned an empty string.");
  }
  if (!response || typeof response !== "object") {
    throw new Error("Puter returned an unexpected response.");
  }
  const r = response as Record<string, unknown>;

  if (typeof r.message === "object" && r.message !== null) {
    const msg = r.message as Record<string, unknown>;
    const fromMsg = messageContentToString(msg.content);
    if (fromMsg) return fromMsg;
  }

  if (Array.isArray(r.choices) && r.choices.length > 0) {
    const ch = r.choices[0];
    if (ch && typeof ch === "object") {
      const message = (ch as Record<string, unknown>).message as
        | Record<string, unknown>
        | undefined;
      if (message) {
        const fromChoice = messageContentToString(message.content);
        if (fromChoice) return fromChoice;
      }
    }
  }

  throw new Error(
    "Could not read model text from Puter. Try another preset model or turn off free mode to use your API key.",
  );
}

/**
 * Browser-only: generates resume JSON via Puter.js (no server API key).
 * Call only from client components / event handlers.
 */
export async function generateResumeViaPuter(
  payload: GeneratePayload,
): Promise<GenerateResumeResponse> {
  const body = payloadToParsed(payload);
  const route = resolvePuterRoute(body);
  const puterModel = resolvePuterModel(route.provider, route.model);
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);

  const preamble = `${STATIC_TAILOR_INSTRUCTIONS}\n\n${body.system_prompt.trim()}${JSON_OBJECT_ONLY_FOOTER}`;
  const fullPrompt = `${preamble}\n\n${buildUserPayload(body)}`;

  let response: unknown;
  try {
    const { puter } = await import("@heyputer/puter.js");
    response = await puter.ai.chat(fullPrompt, {
      model: puterModel,
      max_tokens: maxTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg
        ? `Puter request failed: ${msg}`
        : "Puter request failed. Check the network, your Puter session, or turn off free mode to use your API key.",
    );
  }

  const rawText = extractTextFromPuterResponse(response);
  const data = coerceToJsonValue(rawText);

  let company_name: string | null;
  let job_title: string | null;
  let resume;
  try {
    const parsed = parseTailoredGenerationFromLlm(data, body);
    company_name = parsed.company_name;
    job_title = parsed.job_title;
    resume = parsed.resume;
  } catch (e) {
    if (e instanceof ZodError) {
      const detail = abbrevZodIssues(e);
      throw new Error(
        `Model JSON did not match the tailored output schema. Try again, pick another model, or turn off free mode. (${detail})`,
      );
    }
    throw e;
  }

  return {
    resume,
    company_name,
    job_title,
    generation_meta: {
      resolved_model: puterModel,
      max_tokens: maxTokens,
      input_tokens: null,
      output_tokens: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      estimated_cost_usd: null,
      api_key_source: "puter",
    },
  };
}

/**
 * Browser-only: cover letter via Puter.js.
 */
export async function generateCoverLetterViaPuter(
  payload: CoverLetterPayload,
): Promise<GenerateCoverLetterResponse> {
  const body = generateCoverLetterRequestSchema.parse({
    job_description: payload.job_description,
    source_resume: payload.source_resume,
    resume: payload.resume,
    display_name: payload.display_name,
    company_name: payload.company_name,
    llm_provider: payload.llm_provider,
    llm_model: payload.llm_model,
    anthropic_model: payload.anthropic_model,
    anthropic_max_tokens: payload.anthropic_max_tokens ?? 8192,
    claude_output_effort: payload.claude_output_effort,
  });

  const route = resolvePuterRoute(body as unknown as GenerateResumeRequestParsed);
  const puterModel = resolvePuterModel(route.provider, route.model);
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);

  const preamble = `${STATIC_COVER_LETTER_INSTRUCTIONS}${COVER_LETTER_JSON_FOOTER}`;
  const fullPrompt = `${preamble}\n\n${buildCoverLetterUserPayload(body)}`;

  let response: unknown;
  try {
    const { puter } = await import("@heyputer/puter.js");
    response = await puter.ai.chat(fullPrompt, {
      model: puterModel,
      max_tokens: maxTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg
        ? `Puter request failed: ${msg}`
        : "Puter request failed. Check the network, your Puter session, or turn off free mode to use your API key.",
    );
  }

  const rawText = extractTextFromPuterResponse(response);
  const data = coerceToJsonValue(rawText);

  let letter: string;
  try {
    letter = parseCoverLetterJsonValue(data);
  } catch (e) {
    if (e instanceof ZodError) {
      const detail = abbrevZodIssues(e);
      throw new Error(
        `Model JSON did not match the cover letter schema. Try again, pick another model, or turn off free mode. (${detail})`,
      );
    }
    throw e;
  }

  return {
    letter,
    generation_meta: {
      resolved_model: puterModel,
      max_tokens: maxTokens,
      input_tokens: null,
      output_tokens: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      estimated_cost_usd: null,
      api_key_source: "puter",
    },
  };
}
