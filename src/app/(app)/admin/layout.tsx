import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";
import { fetchProfileRole } from "@/lib/supabase/profile-role";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = await fetchProfileRole(supabase, user.id, user.email);
  if (role !== "admin" && role !== "developer") redirect("/");

  return <>{children}</>;
}
