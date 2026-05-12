import OpenAI from "openai";
import type { GenerationMeta, Resume } from "@/lib/types";
import {
  applyRequestOverrides,
  buildUserPayload,
  STATIC_TAILOR_INSTRUCTIONS,
} from "./resume-prompt";
import { normalizeLlmResumeJson } from "./resume-llm-normalize";
import { type GenerateResumeRequestParsed, resumeSchema } from "./schemas";

/** OpenAI: text-only chat + JSON object mode; resume JSON returned from the API route. */
const JSON_OBJECT_ONLY_FOOTER = `

Output format: respond with a single JSON object only (no markdown code fences, no prose before or after).
The JSON must match the resume structure: target_title, contact (name, email, phone, location, linkedin, website),
summary, skills (array of strings only), experience[] (not professional_experience), education[] (each entry has dates and details, string or null), projects[] (use [] if none).
Each experience item must include "dates" (string period); skills must not be objects. No extra root keys.`;

const GPT41_RATE_MTUSD = { in: 2.0, out: 8.0 } as const;

function estimateOpenAiCostUsd(
  modelId: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const inpEnv = (process.env.OPENAI_PRICE_INPUT_PER_MTOK ?? "").trim();
  const outEnv = (process.env.OPENAI_PRICE_OUTPUT_PER_MTOK ?? "").trim();
  if (inpEnv && outEnv) {
    const pi = Number(inpEnv);
    const po = Number(outEnv);
    if (!Number.isNaN(pi) && !Number.isNaN(po)) {
      const it = inputTokens ?? 0;
      const ot = outputTokens ?? 0;
      return Math.round(((it / 1_000_000) * pi + (ot / 1_000_000) * po) * 1e6) / 1e6;
    }
  }
  const mid = modelId.toLowerCase();
  if (!mid.includes("gpt-4.1")) return null;
  const it = inputTokens ?? 0;
  const ot = outputTokens ?? 0;
  const { in: rin, out: rout } = GPT41_RATE_MTUSD;
  return Math.round(((it / 1_000_000) * rin + (ot / 1_000_000) * rout) * 1e6) / 1e6;
}

export async function generateResumeOpenAI(
  body: GenerateResumeRequestParsed,
  modelId: string,
): Promise<{ resume: Resume; generationMeta: GenerationMeta }> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const resolvedModel = modelId.trim();
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 6144, 8192);

  const client = new OpenAI({ apiKey });

  const systemText = `${STATIC_TAILOR_INSTRUCTIONS}\n\n${body.system_prompt.trim()}${JSON_OBJECT_ONLY_FOOTER}`;

  const completion = await client.chat.completions.create({
    model: resolvedModel,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: buildUserPayload(body) },
    ],
    response_format: { type: "json_object" },
  });

  const choice = completion.choices[0];
  const refusal = choice?.message?.refusal;
  if (refusal) {
    throw new Error(`OpenAI refused to generate: ${refusal}`);
  }
  const raw = choice?.message?.content;
  if (raw == null || raw === "") {
    const reason = choice?.finish_reason ?? "unknown";
    throw new Error(`No text in OpenAI response (finish_reason=${reason})`);
  }

  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? null;
  const outputTokens = usage?.completion_tokens ?? null;
  const estCost = estimateOpenAiCostUsd(resolvedModel, inputTokens, outputTokens);

  const generationMeta: GenerationMeta = {
    resolved_model: resolvedModel,
    max_tokens: maxTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    estimated_cost_usd: estCost,
    api_key_source: "server_environment",
  };

  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Model returned non-JSON output");
  }
  const parsed = resumeSchema.parse(normalizeLlmResumeJson(data));
  const resume = applyRequestOverrides(parsed, body);

  return { resume, generationMeta };
}
