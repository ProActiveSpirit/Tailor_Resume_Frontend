"use client";

import type { ProfileRow } from "@/lib/map-profile-rows";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/roles";
import { APP_ROLES, isAppRole, roleLabel } from "@/lib/roles";
import type { CSSProperties } from "react";
import { useState } from "react";

export type { ProfileRow };

const selectChevronStyle: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236d5342'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
};

const fieldFill = "bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))]";
const fieldControl = `min-h-11 rounded-lg border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25`;
const selectClass = `${fieldControl} w-full max-w-[14rem] appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`;

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function AdminUserRoleTable({
  initialRows,
  fetchError,
}: {
  initialRows: ProfileRow[];
  fetchError: string | null;
}) {
  const [rows, setRows] = useState(initialRows);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string | undefined>>({});

  const onRoleChange = async (id: string, next: AppRole) => {
    setSavingId(id);
    setRowError((e) => ({ ...e, [id]: undefined }));
    const prev = rows.find((r) => r.id === id)?.role;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, role: next } : r)));

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role: next, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      setRowError((e) => ({ ...e, [id]: error.message }));
      if (prev) setRows((list) => list.map((r) => (r.id === id ? { ...r, role: prev } : r)));
    }
    setSavingId(null);
  };

  if (fetchError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900" role="alert">
        {fetchError}
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No users in <code className="rounded bg-accent-soft/50 px-1 py-0.5 text-stone-800">profiles</code> yet.
        Run the database migration and refresh.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-muted)] bg-accent-soft/30">
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Email
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              User ID
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Role
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border-muted)]/80 last:border-0">
              <td className="max-w-[16rem] px-4 py-3 align-middle">
                <span className="break-all text-stone-800">{r.email ?? "—"}</span>
              </td>
              <td className="px-4 py-3 align-middle">
                <code className="text-xs text-stone-600" title={r.id}>
                  {shortId(r.id)}
                </code>
              </td>
              <td className="px-4 py-3 align-middle">
                <div className="flex flex-col gap-1">
                  <select
                    aria-label={`Role for ${r.email ?? r.id}`}
                    className={selectClass}
                    style={selectChevronStyle}
                    value={r.role}
                    disabled={savingId === r.id}
                    onChange={(ev) => {
                      const v = ev.target.value;
                      if (isAppRole(v)) void onRoleChange(r.id, v);
                    }}
                  >
                    {APP_ROLES.map((opt) => (
                      <option key={opt} value={opt}>
                        {roleLabel(opt)}
                      </option>
                    ))}
                  </select>
                  {rowError[r.id] ? (
                    <span className="text-xs text-red-800">{rowError[r.id]}</span>
                  ) : savingId === r.id ? (
                    <span className="text-xs text-stone-500">Saving…</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
