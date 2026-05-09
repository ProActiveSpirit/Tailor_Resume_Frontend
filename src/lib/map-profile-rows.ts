import type { AppRole } from "@/lib/roles";
import { isAppRole } from "@/lib/roles";

export type ProfileRow = { id: string; email: string | null; role: AppRole };

export function mapProfileRows(
  data: { id: unknown; email: unknown; role: unknown }[] | null,
): ProfileRow[] {
  return (data ?? []).map((r) => ({
    id: String(r.id),
    email: r.email != null ? String(r.email) : null,
    role: typeof r.role === "string" && isAppRole(r.role) ? r.role : "normal",
  }));
}
