import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes reachable while signed out. Everything else requires a session. */
const PUBLIC_ROUTES = ["/login", "/signup"];

/**
 * Security architecture, layer 1 of 3: the proxy.
 *
 * Refreshes the Supabase session cookie on every request (keeping tokens from
 * expiring) and performs an *optimistic* redirect for unauthenticated users.
 * This is a coarse gate only — real authorization lives in RLS (layer 2) and
 * the Data Access Layer (layer 3), close to the data.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Until Supabase env vars are set, don't gate anything — lets the app run
  // during setup instead of erroring on every request.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token and must run before any redirect
  // so the refreshed cookie is written back to the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some((r) => path.startsWith(r));

  // Signed out and trying to reach a protected route → send to login.
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed in but on an auth page → send home.
  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
