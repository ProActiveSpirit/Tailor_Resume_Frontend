import type { AppRole } from "@/lib/roles";
import { parseAppRole } from "@/lib/roles";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Escape `%`, `_`, and `\` so a whole email matches literally in Postgres `ILIKE`. */
function escapeIlikeLiteral(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Resolve `profiles.role` by user id, then—if no row—by case-insensitive email match.
 * Use one resolver everywhere (middleware, client menu, server pages) so behavior stays in sync.
 */
export async function fetchProfileRole(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
): Promise<AppRole> {
  const { data: rowById } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (rowById != null) {
    return parseAppRole(rowById.role);
  }

  const trimmed = email?.trim();
  if (!trimmed) {
    return "normal";
  }

  const { data: rowByEmail } = await supabase
    .from("profiles")
    .select("role")
    .ilike("email", escapeIlikeLiteral(trimmed))
    .maybeSingle();

  if (rowByEmail != null) {
    return parseAppRole(rowByEmail.role);
  }

  return "normal";
}
