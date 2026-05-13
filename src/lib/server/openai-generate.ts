import type { GenerationMeta, Resume } from "@/lib/types";
import { createServerOpenAIClient } from "./openai-client";
import {
  buildUserPayload,
  JSON_OBJECT_ONLY_FOOTER,
  STATIC_TAILOR_INSTRUCTIONS,
} from "./resume-prompt";
import { parseTailoredGenerationFromLlm } from "./tailored-output-parse";
import { type GenerateResumeRequestParsed } from "./schemas";

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
): Promise<{
  resume: Resume;
  generationMeta: GenerationMeta;
  company_name: string | null;
  job_title: string | null;
}> {
  const resolvedModel = modelId.trim();
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);

  const client = createServerOpenAIClient();

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
  const { company_name, job_title, resume } = parseTailoredGenerationFromLlm(data, body);

  return { resume, generationMeta, company_name, job_title };
}
