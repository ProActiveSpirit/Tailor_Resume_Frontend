import { type NextRequest, NextResponse } from "next/server";

import { fetchProfileRole } from "@/lib/supabase/profile-role";
import { updateSession } from "@/lib/supabase/middleware";

function isPublicPath(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  ) {
    return true;
  }
  if (pathname.startsWith("/auth")) {
    return true;
  }
  return false;
}

function passthroughCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value);
  });
}

function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  targetPath: string,
) {
  const url = new URL(targetPath, request.url);
  const res = NextResponse.redirect(url);
  passthroughCookies(supabaseResponse, res);
  return res;
}

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (isPublicPath(path)) {
    if ((path === "/login" || path === "/signup") && user && supabase) {
      const role = await fetchProfileRole(supabase, user.id, user.email);
      if (role === "normal") {
        return redirectWithSession(request, supabaseResponse, "/pending");
      }
      return redirectWithSession(request, supabaseResponse, "/");
    }
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (supabase && (path === "/" || path === "/pending")) {
    const role = await fetchProfileRole(supabase, user.id, user.email);
    if (path === "/" && role === "normal") {
      return redirectWithSession(request, supabaseResponse, "/pending");
    }
    if (path === "/pending" && (role === "admin" || role === "developer")) {
      return redirectWithSession(request, supabaseResponse, "/");
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
