import type { GenerationMeta, Resume } from "@/lib/types";
import { generateResumeAnthropic } from "./claude-generate";
import { generateResumeOpenAI } from "./openai-generate";
import type { GenerateResumeRequestParsed } from "./schemas";

export type LlmRoute = { provider: "anthropic" | "openai"; model: string };

export function resolveLlmRoute(body: GenerateResumeRequestParsed): LlmRoute {
  const explicit = body.llm_provider;
  const llmModel = body.llm_model?.trim();
  const anth = body.anthropic_model?.trim();

  if (explicit === "openai") {
    return {
      provider: "openai",
      model: llmModel || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-4.1",
    };
  }
  if (explicit === "anthropic") {
    return {
      provider: "anthropic",
      model:
        llmModel ||
        anth ||
        (process.env.ANTHROPIC_MODEL ?? "").trim() ||
        "claude-sonnet-4-6",
    };
  }
  if (anth) {
    return { provider: "anthropic", model: anth };
  }
  return {
    provider: "openai",
    model: llmModel || (process.env.OPENAI_MODEL ?? "").trim() || "gpt-4.1",
  };
}

export async function generateResumeStructured(
  body: GenerateResumeRequestParsed,
): Promise<{ resume: Resume; generationMeta: GenerationMeta }> {
  const route = resolveLlmRoute(body);
  if (route.provider === "openai") {
    return generateResumeOpenAI(body, route.model);
  }
  return generateResumeAnthropic(body, route.model);
}
