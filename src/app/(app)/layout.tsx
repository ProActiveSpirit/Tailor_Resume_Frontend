import { AppRoleProvider } from "@/components/app-role-provider";
import { fetchProfileRole } from "@/lib/supabase/profile-role";
import { createClient } from "@/lib/supabase/server";
import type { ReactNode } from "react";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialAppRole = user
    ? await fetchProfileRole(supabase, user.id, user.email)
    : "normal";
  const initialEmail = user?.email ?? null;

  return (
    <AppRoleProvider initialAppRole={initialAppRole} initialEmail={initialEmail}>
      {children}
    </AppRoleProvider>
  );
}
