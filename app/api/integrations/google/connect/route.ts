import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/data/session";
import { buildAuthUrl, createPkcePair, createState } from "@/lib/google/oauth";
import {
  OAUTH_COOKIE_OPTIONS,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/google/cookies";

/**
 * Step 1 of linking Google: mint a state + PKCE pair, stash them in short-lived
 * httpOnly cookies, and bounce the user to Google's consent screen.
 *
 * Requires an SFRM session. Google is a *linked data source*, not a way in —
 * there is no path here that creates or authenticates an SFRM user.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    // Reached only if someone hits this URL signed out; the proxy normally
    // redirects first. Send them to login rather than to Google.
    return NextResponse.redirect(new URL("/login", requiredSiteUrl()));
  }

  const state = createState();
  const { verifier, challenge } = createPkcePair();

  const jar = await cookies();
  jar.set(STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS);
  jar.set(VERIFIER_COOKIE, verifier, OAUTH_COOKIE_OPTIONS);

  return NextResponse.redirect(
    buildAuthUrl({
      state,
      codeChallenge: challenge,
      loginHint: user.email ?? undefined,
    }),
  );
}

function requiredSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
