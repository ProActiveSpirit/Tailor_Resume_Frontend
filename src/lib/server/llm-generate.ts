import type { GenerationMeta, Resume } from "@/lib/types";
import { generateResumeAnthropic } from "./claude-generate";
import { generateResumeOpenAI } from "./openai-generate";
import type { GenerateResumeRequestParsed } from "./schemas";

export type LlmRoute = { provider: "anthropic" | "openai"; model: string };

/** UI preset `claude-opus-4-6-fast` maps to Puter's fast id; Anthropic API uses the base Opus 4.6 model. */
export function normalizeAnthropicApiModelId(modelId: string): string {
  const m = modelId.trim();
  if (m === "claude-opus-4-6-fast") return "claude-opus-4-6";
  return m;
}

export type LlmRouteInput = Pick<
  GenerateResumeRequestParsed,
  "llm_provider" | "llm_model" | "anthropic_model"
>;

export function resolveLlmRouteFromPrefs(p: LlmRouteInput): LlmRoute {
  const explicit = p.llm_provider;
  const llmModel = p.llm_model?.trim();
  const anth = p.anthropic_model?.trim();

  if (explicit === "openai") {
    return {
      provider: "openai",
      model: llmModel || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-4.1",
    };
  }
  if (explicit === "anthropic") {
    const raw =
      llmModel ||
      anth ||
      (process.env.ANTHROPIC_MODEL ?? "").trim() ||
      "claude-sonnet-4-6";
    return {
      provider: "anthropic",
      model: normalizeAnthropicApiModelId(raw),
    };
  }
  if (anth) {
    return {
      provider: "anthropic",
      model: normalizeAnthropicApiModelId(anth),
    };
  }
  return {
    provider: "openai",
    model: llmModel || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-4.1",
  };
}

export function resolveLlmRoute(body: GenerateResumeRequestParsed): LlmRoute {
  return resolveLlmRouteFromPrefs(body);
}

export async function generateResumeStructured(
  body: GenerateResumeRequestParsed,
): Promise<{
  resume: Resume;
  generationMeta: GenerationMeta;
  company_name: string | null;
  job_title: string | null;
}> {
  const route = resolveLlmRoute(body);
  if (route.provider === "openai") {
    return generateResumeOpenAI(body, route.model);
  }
  return generateResumeAnthropic(body, route.model);
}
