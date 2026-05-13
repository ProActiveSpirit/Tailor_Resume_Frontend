import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlockParam,
  Message,
  OutputConfig,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import type { GenerationMeta, Resume } from "@/lib/types";
import {
  buildUserPayload,
  STATIC_TAILOR_INSTRUCTIONS,
} from "./resume-prompt";
import { parseTailoredGenerationFromLlm } from "./tailored-output-parse";
import {
  type GenerateResumeRequestParsed,
  tailoredGenerationJsonSchema,
} from "./schemas";

const MODEL_RATE_MTUSD: readonly (readonly [string, number, number])[] = [
  ["claude-opus-4-7", 5.0, 25.0],
  ["claude-opus-4", 15.0, 75.0],
  ["claude-sonnet-4", 3.0, 15.0],
  ["claude-3-5-haiku", 1.0, 5.0],
  ["claude-3-5-sonnet", 3.0, 15.0],
  ["claude-3-opus", 15.0, 75.0],
];

function extractOutputText(content: Message["content"]): string {
  for (const block of content) {
    if (block.type === "text") return block.text;
  }
  throw new Error("No text block in Claude response");
}

function usageInt(u: Message["usage"], ...names: string[]): number | null {
  for (const name of names) {
    const raw = (u as unknown as Record<string, unknown>)[name];
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(n)) return Math.trunc(n);
  }
  return null;
}

function extractUsage(u: Message["usage"]): {
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
} {
  return {
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_creation_input_tokens: usageInt(
      u,
      "cache_creation_input_tokens",
      "cache_creation_input_token_count",
    ),
    cache_read_input_tokens: usageInt(
      u,
      "cache_read_input_tokens",
      "cache_read_input_token_count",
    ),
  };
}

function estimateCostUsd(
  modelId: string,
  inputTokens: number | null,
  outputTokens: number | null,
  cacheRead: number | null,
  cacheCreation: number | null,
): number | null {
  const inpEnv = (process.env.ANTHROPIC_PRICE_INPUT_PER_MTOK ?? "").trim();
  const outEnv = (process.env.ANTHROPIC_PRICE_OUTPUT_PER_MTOK ?? "").trim();
  const cacheReadEnv = (process.env.ANTHROPIC_PRICE_CACHE_READ_PER_MTOK ?? "").trim();
  if (inpEnv && outEnv) {
    try {
      const pi = Number(inpEnv);
      const po = Number(outEnv);
      if (!Number.isNaN(pi) && !Number.isNaN(po)) {
        const pcr = cacheReadEnv ? Number(cacheReadEnv) : pi * 0.1;
        const it = inputTokens ?? 0;
        const ot = outputTokens ?? 0;
        const cr = cacheRead ?? 0;
        const cc = cacheCreation ?? 0;
        const sum =
          (it / 1_000_000) * pi +
          (ot / 1_000_000) * po +
          (cr / 1_000_000) * pcr +
          (cc / 1_000_000) * pi;
        return Math.round(sum * 1e6) / 1e6;
      }
    } catch {
      /* fall through */
    }
  }
  const mid = modelId.toLowerCase();
  let pi = 3.0;
  let po = 15.0;
  let found = false;
  for (const [prefix, rin, rout] of MODEL_RATE_MTUSD) {
    if (mid.includes(prefix)) {
      pi = rin;
      po = rout;
      found = true;
      break;
    }
  }
  if (!found) return null;
  const pcr = pi * 0.1;
  const it = inputTokens ?? 0;
  const ot = outputTokens ?? 0;
  const cr = cacheRead ?? 0;
  const cc = cacheCreation ?? 0;
  const sum =
    (it / 1_000_000) * pi +
    (ot / 1_000_000) * po +
    (cr / 1_000_000) * pcr +
    (cc / 1_000_000) * pi;
  return Math.round(sum * 1e6) / 1e6;
}

export async function generateResumeAnthropic(
  body: GenerateResumeRequestParsed,
  modelId: string,
): Promise<{
  resume: Resume;
  generationMeta: GenerationMeta;
  company_name: string | null;
  job_title: string | null;
}> {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const resolvedModel = modelId.trim();
  const maxTokens = Math.min(body.anthropic_max_tokens ?? 8192, 8192);

  const client = new Anthropic({ apiKey });

  const schema = tailoredGenerationJsonSchema();

  const systemBlocks: TextBlockParam[] = [
    {
      type: "text",
      text: STATIC_TAILOR_INSTRUCTIONS,
      cache_control: { type: "ephemeral", ttl: "5m" },
    },
    {
      type: "text",
      text: body.system_prompt.trim(),
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
      text: buildUserPayload(body),
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

  const u = extractUsage(response.usage);
  const estCost = estimateCostUsd(
    resolvedModel,
    u.input_tokens,
    u.output_tokens,
    u.cache_read_input_tokens,
    u.cache_creation_input_tokens,
  );

  const generationMeta: GenerationMeta = {
    resolved_model: resolvedModel,
    max_tokens: maxTokens,
    input_tokens: u.input_tokens,
    output_tokens: u.output_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens,
    cache_read_input_tokens: u.cache_read_input_tokens,
    estimated_cost_usd: estCost,
    api_key_source: "server_environment",
  };

  const raw = extractOutputText(response.content);
  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Model returned non-JSON output");
  }
  const { company_name, job_title, resume } = parseTailoredGenerationFromLlm(data, body);

  return { resume, generationMeta, company_name, job_title };
}
