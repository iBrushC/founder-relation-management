import "server-only";

import { GoogleAuthError } from "./oauth";

/**
 * Gmail REST client — the two calls SFRM needs, over raw `fetch`.
 *
 * No `googleapis` SDK, matching the deliberate choice in ./oauth and
 * lib/ai/openrouter: this is two endpoints and a header, and the SDK would pull
 * a very large dependency tree to save a few lines.
 *
 * Scope note: everything here relies on `gmail.readonly`. The narrower
 * `gmail.metadata` scope would be an easier verification story (see
 * GOOGLE_SCOPES), but it *forbids the `q=` search parameter* — and searching by
 * address is the entire matching strategy. Dropping to metadata would mean
 * listing the whole mailbox and filtering client-side, so readonly stays.
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Headers we ask for. Anything not listed here isn't returned by `format=metadata`. */
const METADATA_HEADERS = ["Subject", "From", "To", "Cc", "Date"] as const;

/** Raised when Gmail refuses a call for a non-auth reason (quota, 5xx, malformed). */
export class GmailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GmailError";
  }
}

type GmailHeader = { name: string; value: string };

export type GmailMessage = {
  id: string;
  threadId: string;
  /** Gmail's own short preview of the message. Never a full body. */
  snippet?: string;
  /** Epoch milliseconds, as a string — Gmail's own send/receive timestamp. */
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

export type GmailThread = {
  id: string;
  messages?: GmailMessage[];
};

/**
 * One authenticated Gmail call.
 *
 * A 401 becomes `GoogleAuthError` so callers treat it exactly like a dead
 * refresh token — the grant needs re-consent, and retrying can't help. Every
 * other failure is a `GmailError`, which is transient-ish and per-request.
 */
async function gmailFetch<T>(
  accessToken: string,
  path: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });

  if (res.status === 401) {
    throw new GoogleAuthError("Gmail rejected the access token", "invalid_grant");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new GmailError(
      body?.error?.message ?? `Gmail request failed (HTTP ${res.status})`,
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

/**
 * Thread ids matching a Gmail search query, newest first (Gmail's own order).
 *
 * Returns ids only — `threads.list` doesn't include messages, so each thread
 * still needs a `getThread` to be useful. `maxResults` caps a single page; we
 * deliberately don't paginate, since a manual sync should stay bounded and
 * predictable rather than walking a decade of mail on one click.
 */
export async function listThreadIds(
  accessToken: string,
  query: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<string[]> {
  const json = await gmailFetch<{ threads?: { id: string }[] }>(
    accessToken,
    "/threads",
    new URLSearchParams({ q: query, maxResults: String(maxResults) }),
    signal,
  );
  return (json.threads ?? []).map((t) => t.id);
}

/**
 * One thread with per-message headers and snippets.
 *
 * `format=metadata` + an explicit header allowlist: we want who/when/subject,
 * not message bodies. Snippets still come back (they're a top-level message
 * field, not part of the payload), which is what makes a timeline entry
 * readable without ever storing correspondence.
 */
export async function getThread(
  accessToken: string,
  threadId: string,
  signal?: AbortSignal,
): Promise<GmailThread> {
  const params = new URLSearchParams({ format: "metadata" });
  for (const h of METADATA_HEADERS) params.append("metadataHeaders", h);
  return gmailFetch<GmailThread>(
    accessToken,
    `/threads/${encodeURIComponent(threadId)}`,
    params,
    signal,
  );
}

/** Case-insensitive header lookup — Gmail's casing isn't guaranteed. */
export function header(message: GmailMessage, name: string): string {
  const found = message.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

/**
 * Pull the bare address out of a From/To header value.
 *
 * `"Maya Chen" <maya@acme.com>` → `maya@acme.com`; a bare `maya@acme.com` passes
 * through. Lowercased, because addresses compare case-insensitively in practice
 * and Gmail echoes back whatever casing the sender typed.
 */
export function parseAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim().toLowerCase();
}

/**
 * A Gmail search query matching mail either direction with `address`.
 *
 * The braces are Gmail's OR-group syntax. The address is quoted so a stray
 * space or operator-looking character in stored data can't restructure the
 * query — a malformed address should return nothing, not something else.
 */
export function addressQuery(address: string, withinDays: number): string {
  const safe = address.replace(/"/g, "");
  return `{from:"${safe}" to:"${safe}" cc:"${safe}"} newer_than:${withinDays}d`;
}
