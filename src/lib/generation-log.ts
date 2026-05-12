/** Stored when target role is not collected; admin UI maps this to an em dash. */
export const GENERATION_LOG_PLACEHOLDER_TARGET_ROLE = "(not specified)" as const;

export function formatGenerationLogTargetRole(raw: string | null): string {
  const t = raw?.trim();
  if (!t || t === GENERATION_LOG_PLACEHOLDER_TARGET_ROLE) return "—";
  return t;
}
