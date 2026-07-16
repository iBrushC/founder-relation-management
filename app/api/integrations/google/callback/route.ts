import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/data/session";
import { safeEqual } from "@/lib/google/crypto";
import {
  OAUTH_COOKIE_OPTIONS,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/google/cookies";
import {
  exchangeCode,
  fetchGoogleUserInfo,
  GOOGLE_SCOPES,
  revokeToken,
} from "@/lib/google/oauth";
import { saveGoogleAccount } from "@/lib/google/tokens";

/**
 * Step 2 of linking Google: Google redirects the user back here with a one-time
 * authorization code, which we trade for tokens and store.
 *
 * Every failure path lands the user back on /settings with a `google` query flag
 * rather than showing a raw error page — this is a redirect target, not an API
 * the client reads.
 */
export async function GET(request: NextRequest) {
  const jar = await cookies();
  const clearCookies = () => {
    jar.delete({ name: STATE_COOKIE, path: OAUTH_COOKIE_OPTIONS.path });
    jar.delete({ name: VERIFIER_COOKIE, path: OAUTH_COOKIE_OPTIONS.path });
  };

  // The session is re-checked here, not merely assumed from step 1: this handler
  // is what writes a Gmail grant into a row keyed by user id, so the user id must
  // come from a revalidated token rather than from anything Google echoed back.
  const user = await getSessionUser();
  if (!user) {
    clearCookies();
    return settingsRedirect(request, "error");
  }

  const params = request.nextUrl.searchParams;

  // The user pressed "Cancel" on the consent screen, or Google refused.
  const oauthError = params.get("error");
  if (oauthError) {
    clearCookies();
    return settingsRedirect(request, oauthError === "access_denied" ? "denied" : "error");
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(VERIFIER_COOKIE)?.value;

  clearCookies();

  // CSRF gate: without this, an attacker could hand a victim a crafted callback
  // URL carrying the ATTACKER's code and silently bind their Gmail to the
  // victim's SFRM account. Constant-time compare; missing values fail closed.
  if (!code || !state || !expectedState || !verifier || !safeEqual(state, expectedState)) {
    return settingsRedirect(request, "error");
  }

  try {
    const tokens = await exchangeCode(code, verifier);

    // Consent is per-scope and the user can untick boxes. If Gmail read access
    // didn't come back, the link would exist but do nothing — so refuse it and
    // hand the grant back rather than storing a token we can't use.
    if (!grantedAll(tokens.scope)) {
      await revokeToken(tokens.accessToken);
      return settingsRedirect(request, "scope");
    }

    // `access_type=offline` + `prompt=consent` should always yield a refresh
    // token. If it somehow doesn't, storing the access token alone would give a
    // link that breaks in an hour with no way back — fail loudly instead.
    if (!tokens.refreshToken) {
      await revokeToken(tokens.accessToken);
      return settingsRedirect(request, "error");
    }

    const info = await fetchGoogleUserInfo(tokens.accessToken);

    await saveGoogleAccount({
      ownerId: user.id,
      googleUserId: info.sub,
      email: info.email,
      tokens: { ...tokens, refreshToken: tokens.refreshToken },
    });

    return settingsRedirect(request, "connected");
  } catch (e) {
    console.error("Google OAuth callback failed:", e);
    return settingsRedirect(request, "error");
  }
}

/** Did Google grant everything we asked for? Scope order is not guaranteed. */
function grantedAll(granted: string): boolean {
  const set = new Set(granted.split(" ").filter(Boolean));
  return GOOGLE_SCOPES.every((s) => set.has(s));
}

/**
 * Redirect to /settings carrying the outcome. Built from `request.nextUrl` so it
 * stays same-origin — the value is ours, never anything Google or the user sent.
 */
function settingsRedirect(request: NextRequest, status: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/settings";
  url.search = "";
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}
