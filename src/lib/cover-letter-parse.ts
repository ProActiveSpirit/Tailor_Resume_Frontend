import { coverLetterBodySchema } from "@/lib/server/schemas";

/** Parse Puter / LLM JSON object shape `{ letter: string }`. */
export function parseCoverLetterJsonValue(data: unknown): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Model JSON did not match the cover letter schema");
  }
  const letterRaw = (data as Record<string, unknown>).letter;
  if (typeof letterRaw !== "string") {
    throw new Error("Model JSON did not match the cover letter schema");
  }
  const parsed = coverLetterBodySchema.parse({ letter: letterRaw });
  const t = parsed.letter.trim();
  if (!t) {
    throw new Error("Cover letter model returned an empty letter");
  }
  return t;
}
