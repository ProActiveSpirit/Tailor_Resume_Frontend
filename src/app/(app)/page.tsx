import { createClient } from "@/lib/supabase/server";
import {
  type TailorInitialProfile,
  TAILOR_PROFILE_DB_COLUMNS,
} from "@/lib/tailor-initial-profile";
import { TailorHomeClient } from "./tailor-home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialProfile: TailorInitialProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select(TAILOR_PROFILE_DB_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    initialProfile = (data ?? null) as TailorInitialProfile | null;
  }

  return (
    <TailorHomeClient
      initialProfile={initialProfile}
      authEmail={user?.email ?? null}
    />
  );
}
