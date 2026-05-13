"use client";

import type { AppRole } from "@/lib/roles";
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

type AppRoleBootstrap = {
  initialAppRole: AppRole;
  initialEmail: string | null;
};

const AppRoleContext = createContext<AppRoleBootstrap>({
  initialAppRole: "normal",
  initialEmail: null,
});

export function AppRoleProvider({
  initialAppRole,
  initialEmail,
  children,
}: {
  initialAppRole: AppRole;
  initialEmail: string | null;
  children: ReactNode;
}) {
  const value = useMemo(
    (): AppRoleBootstrap => ({ initialAppRole, initialEmail }),
    [initialAppRole, initialEmail],
  );

  return (
    <AppRoleContext.Provider value={value}>{children}</AppRoleContext.Provider>
  );
}

export function useAppRoleBootstrap(): AppRoleBootstrap {
  return useContext(AppRoleContext);
}
