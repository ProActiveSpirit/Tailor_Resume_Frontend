import OpenAI from "openai";

/** Non-empty trimmed value, or undefined (treats "" as missing). */
function envOptional(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

/**
 * Shared OpenAI client for API routes. Trims keys and treats blank org/project
 * env values as unset (null).
 *
 * Important: the OpenAI SDK constructor defaults read OPENAI_ORG_ID / OPENAI_PROJECT_ID
 * via readEnv(). An empty entry in `.env` (e.g. OPENAI_ORG_ID=) yields "" not
 * undefined, and the SDK would send OpenAI-Organization / OpenAI-Project with an
 * empty value — OpenAI often responds with 403. We always pass organization and
 * project explicitly (string or null) so blank env lines do not become headers.
 *
 * Supports OPENAI_ORGANIZATION as an alias for OPENAI_ORG_ID.
 */
export function createServerOpenAIClient(): OpenAI {
  const apiKey = envOptional("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const organization =
    envOptional("OPENAI_ORG_ID") ??
    envOptional("OPENAI_ORGANIZATION") ??
    null;
  const project = envOptional("OPENAI_PROJECT_ID") ?? null;
  const baseURL = envOptional("OPENAI_BASE_URL");

  return new OpenAI({
    apiKey,
    organization,
    project,
    ...(baseURL != null ? { baseURL } : {}),
  });
}
