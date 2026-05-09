export type AppRole = "admin" | "developer" | "normal";

/** Order shown in Members role selects. */
export const APP_ROLES: AppRole[] = ["admin", "developer", "normal"];

export function roleLabel(role: AppRole): string {
  if (role === "admin") return "Admin";
  if (role === "developer") return "Developer";
  return "Normal";
}

export function isAppRole(value: string): value is AppRole {
  const n = value.trim().toLowerCase();
  return n === "admin" || n === "developer" || n === "normal";
}

export function parseAppRole(value: unknown): AppRole {
  if (typeof value !== "string") return "normal";
  const n = value.trim().toLowerCase();
  if (n === "admin" || n === "developer" || n === "normal") return n;
  return "normal";
}
