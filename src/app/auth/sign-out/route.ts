import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function getEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Clears Supabase SSR cookies on the server so sign-out works even when the
 * browser client session is stale.
 */
export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!env) {
    return NextResponse.json(
      { detail: "Authentication is not configured." },
      { status: 503 },
    );
  }

  let response = NextResponse.json({ ok: true as const });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.json({ ok: true as const });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn("[auth/sign-out]", error.message);
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }

  return response;
}
