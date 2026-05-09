"use client";

import { createClient } from "@/lib/supabase/client";
import { fetchProfileRole } from "@/lib/supabase/profile-role";
import type { AppRole } from "@/lib/roles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.slice(0, 1).toUpperCase() || "?";
}

export function UserMenu() {
  const router = useRouter();
  const menuId = useId();
  const [email, setEmail] = useState<string | null>(null);
  const [appRole, setAppRole] = useState<AppRole>("normal");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchRole = useCallback(async (uid: string, sessionEmail: string | null) => {
    const supabase = createClient();
    const role = await fetchProfileRole(supabase, uid, sessionEmail);
    setAppRole(role);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const u = session?.user;
      setEmail(u?.email ?? null);
      if (u?.id) void fetchRole(u.id, u.email ?? null);
      else setAppRole("normal");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user;
      setEmail(u?.email ?? null);
      if (u?.id) void fetchRole(u.id, u.email ?? null);
      else setAppRole("normal");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  if (!email) return null;

  const initials = initialsFromEmail(email);
  const showMembers = appRole === "admin";

  const itemClass =
    "block w-full px-3 py-2 text-left text-sm text-stone-800 transition hover:bg-accent-soft/60 rounded-md";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-muted)] bg-accent-soft/80 text-sm font-semibold tracking-tight text-accent-strong shadow-sm transition hover:border-accent hover:bg-accent-soft"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">Account menu</span>
        <span aria-hidden>{initials}</span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-1.5 min-w-[12.5rem] rounded-xl border border-[var(--border-muted)] bg-[var(--card)] py-1 shadow-[0_8px_28px_var(--shadow-soft)]"
        >
          <Link
            href="/profile"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          {showMembers ? (
            <>
              <Link
                href="/admin/users"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                Members
              </Link>
              <Link
                href="/admin/logs"
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                Log
              </Link>
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
