import "server-only";

/**
 * The short-lived cookies that carry OAuth state across the round trip to
 * Google. Shared by the connect and callback handlers so the names and flags
 * can't drift apart.
 */

export const STATE_COOKIE = "google_oauth_state";
export const VERIFIER_COOKIE = "google_oauth_verifier";

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // "lax" is required, not incidental: Google returns the user via a top-level
  // cross-site GET redirect, and "strict" would withhold these cookies on that
  // navigation — the callback would see no state and reject every attempt.
  sameSite: "lax",
  path: "/api/integrations/google",
  maxAge: 60 * 10, // 10 minutes is plenty to click through consent.
} as const;
