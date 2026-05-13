import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  OutputConfig,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { GenerationMeta } from "@/lib/types";
import { createServerOpenAIClient } from "./openai-client";
import { parseCoverLetterJsonValue } from "@/lib/cover-letter-parse";
import {
  buildCoverLetterUserPayload,
  COVER_LETTER_JSON_FOOTER,
  STATIC_COVER_LETTER_INSTRUCTIONS,
} from "./cover-letter-prompt";
import {
  resolveLlmRouteFromPrefs,
  type LlmRouteInput,
} from "./llm-generate";
import {
  coverLetterJsonSchema,
  type GenerateCoverLetterRequestParsed,
} from "./schemas";

function extractClaudeText(content: Message["content"]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  throw new Error("No text block in Claude response");
}

function claudeUsageInt(u: Message["usage"], ...names: string[]): number | null {
  for (const name of names) {
    const raw = (u as unknown as Record<string, unknown>)[name];
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(n)) return Math.trunc(n);
  }
  return null;
}

function extractClaudeUsage(u: Message["usage"]): {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
} {
  return {
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_creation_input_tokens: claudeUsageInt(
      u,
      "cache_creation_input_tokens",
      "cache_creation_input_token_count",
    ),
    cache_read_input_tokens: claudeUsageInt(
      u,
      "cache_read_input_tokens",
      "cache_read_input_token_count",
    ),
  };
}

function parseLetterJson(raw: string): string {
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Model returned non-JSON output");
  }
  return parseCoverLetterJsonValue(data);
}

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
  return null;
}

export async function generateCoverLetterAnthropic(
  body: GenerateCoverLetterRequestParsed,
  modelId: string,
): Promise<{ letter: string; generationMeta: GenerationMeta }> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const resolvedModel = modelId.trim();
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);
  const client = new Anthropic({ apiKey });

  const schema = coverLetterJsonSchema();

  const systemBlocks: TextBlockParam[] = [
    {
      type: "text",
      text: STATIC_COVER_LETTER_INSTRUCTIONS,
      cache_control: { type: "ephemeral", ttl: "5m" },
    },
  ];

  const outputConfig: OutputConfig = {
    format: {
      type: "json_schema",
      schema: schema as { [key: string]: unknown },
    },
  };
  if (body.claude_output_effort) {
    outputConfig.effort = body.claude_output_effort as OutputConfig["effort"];
  }

  const userContent: ContentBlockParam[] = [
    {
      type: "text",
      text: `${buildCoverLetterUserPayload(body)}${COVER_LETTER_JSON_FOOTER}`,
      cache_control: { type: "ephemeral", ttl: "5m" },
    },
  ];

  const response = await client.messages.create({
    model: resolvedModel,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages: [{ role: "user", content: userContent }],
    output_config: outputConfig,
  });

  const u = extractClaudeUsage(response.usage);
  const generationMeta: GenerationMeta = {
    resolved_model: resolvedModel,
    max_tokens: maxTokens,
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens,
    cache_read_input_tokens: u.cache_read_input_tokens,
    estimated_cost_usd: null,
    api_key_source: "server_environment",
  };

  const raw = extractClaudeText(response.content);
  const letter = parseLetterJson(raw);
  return { letter, generationMeta };
}

export async function generateCoverLetterOpenAI(
  body: GenerateCoverLetterRequestParsed,
  modelId: string,
): Promise<{ letter: string; generationMeta: GenerationMeta }> {
  const resolvedModel = modelId.trim();
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);
  const client = createServerOpenAIClient();

  const systemText = `${STATIC_COVER_LETTER_INSTRUCTIONS}${COVER_LETTER_JSON_FOOTER}`;

  const completion = await client.chat.completions.create({
    model: resolvedModel,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: systemText },
      { role: "user", content: buildCoverLetterUserPayload(body) },
    ],
    response_format: { type: "json_object" },
  });

  const choice = completion.choices[0];
  const refusal = choice?.message?.refusal;
  if (refusal) {
    throw new Error(`OpenAI refused to generate: ${refusal}`);
  }
  const content = choice?.message?.content;
  if (content == null || content === "") {
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

  const letter = parseLetterJson(content);
  return { letter, generationMeta };
}

function routeInputFromCoverBody(
  body: GenerateCoverLetterRequestParsed,
): LlmRouteInput {
  return {
    llm_provider: body.llm_provider,
    llm_model: body.llm_model,
    anthropic_model: body.anthropic_model,
  };
}

export async function generateCoverLetterStructured(
  body: GenerateCoverLetterRequestParsed,
): Promise<{ letter: string; generationMeta: GenerationMeta }> {
  const route = resolveLlmRouteFromPrefs(routeInputFromCoverBody(body));
  if (route.provider === "openai") {
    return generateCoverLetterOpenAI(body, route.model);
  }
  return generateCoverLetterAnthropic(body, route.model);
}
