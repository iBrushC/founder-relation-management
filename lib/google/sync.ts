import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { connections, emailThreads, googleAccounts } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { withUserRLS } from "@/lib/db/rls";
import {
  addressQuery,
  getThread,
  header,
  listThreadIds,
  parseAddress,
  type GmailMessage,
  type GmailThread,
} from "./gmail";
import { getAccessToken } from "./tokens";

/**
 * Gmail → `email_threads` sync.
 *
 * Shape of the thing: for each connection whose address(es) we know, ask Gmail
 * for threads involving those addresses, and mirror each *thread* to one row.
 * An email chain is a single interaction — that requirement is why the unit here
 * is a thread rather than a message, and it falls out of the data model instead
 * of being de-duplicated after the fact.
 *
 * The sync is idempotent: rows upsert on (owner, connection, thread), so running
 * it twice is a no-op and running it after a new reply just updates the counts
 * and timestamp. Nothing here ever touches `connections.interactions` — the
 * user's hand-written timeline is a separate store that sync cannot corrupt.
 */

/** How far back a sync looks. A year of mail is plenty for a CRM timeline. */
const WINDOW_DAYS = 365;

/** Per-address cap on threads fetched in one sync. Keeps a manual click bounded. */
const MAX_THREADS_PER_ADDRESS = 25;

/**
 * How many Gmail calls we allow in flight at once.
 *
 * Gmail's per-user limit is 250 quota units/second and `threads.get` costs 10,
 * so ~25 concurrent calls is the theoretical ceiling. 5 keeps a comfortable
 * margin: a 429 would fail the whole sync, and this is a button the user waits
 * on, not a background job that can back off and retry.
 */
const CONCURRENCY = 5;

export type SyncSummary = {
  /** Connections that had at least one address to search. */
  scanned: number;
  /** Threads mirrored (created + updated). */
  threads: number;
  /** Connections that gained at least one thread they didn't have before. */
  matched: number;
  /** True when any address hit the per-address cap — the sweep wasn't exhaustive. */
  truncated: boolean;
};

type Target = { connectionId: string; addresses: string[] };

/** Run `task` over `items` with a fixed concurrency ceiling, preserving order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await task(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Normalise and de-duplicate the addresses we'll search for one person. */
function addressesFor(row: {
  email: string | null;
  altEmails: string[] | null;
}): string[] {
  const all = [row.email ?? "", ...(row.altEmails ?? [])]
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.includes("@"));
  return [...new Set(all)];
}

/**
 * Collapse a Gmail thread into the row we store.
 *
 * `direction` is judged against the user's own Google address: a thread they
 * only sent to reads "sent", one they only received reads "received", a real
 * back-and-forth reads "both". Subject comes from the first message (replies
 * carry "Re:" noise); snippet and timestamp come from the most recent, since
 * that's what the timeline is actually reporting.
 */
type ThreadSummary = {
  subject: string;
  snippet: string;
  lastMessageAt: Date;
  messageCount: number;
  direction: string;
};

function summarize(
  thread: GmailThread,
  selfAddress: string,
): ThreadSummary | null {
  const messages = thread.messages ?? [];
  if (messages.length === 0) return null;

  const timeOf = (m: GmailMessage) => Number(m.internalDate ?? 0);
  const ordered = [...messages].sort((a, b) => timeOf(a) - timeOf(b));
  const first = ordered[0];
  const latest = ordered[ordered.length - 1];

  let sent = false;
  let received = false;
  for (const m of ordered) {
    if (parseAddress(header(m, "From")) === selfAddress) sent = true;
    else received = true;
  }

  const lastMs = timeOf(latest);

  return {
    subject: header(first, "Subject"),
    snippet: latest.snippet ?? "",
    // Fall back to now rather than epoch 0: a thread with no internalDate is a
    // Gmail anomaly, and 1970 would silently bury it at the end of the timeline.
    lastMessageAt: lastMs > 0 ? new Date(lastMs) : new Date(),
    messageCount: ordered.length,
    direction: sent && received ? "both" : sent ? "sent" : "received",
  };
}

/**
 * Sweep Gmail for every connection with a known address and mirror the results.
 *
 * `ownerId` MUST come from `verifySession()` — `getAccessToken` trusts it, and
 * it decides whose mailbox gets read. Returns null when the user has no Google
 * link at all (the caller reports "connect Google first" rather than an error).
 * Throws `GoogleAuthError` when the grant is dead — `getAccessToken` has already
 * dropped the row by then, so the UI reads as disconnected.
 */
export async function syncGmail(
  ownerId: string,
  signal?: AbortSignal,
): Promise<SyncSummary | null> {
  const accessToken = await getAccessToken(ownerId);
  if (!accessToken) return null;

  const [account] = await db
    .select({ email: googleAccounts.email })
    .from(googleAccounts)
    .where(eq(googleAccounts.ownerId, ownerId))
    .limit(1);
  const selfAddress = (account?.email ?? "").trim().toLowerCase();

  // Read the address book under RLS: it's ordinary CRM data, and this is also
  // what scopes the sweep to this user's own connections.
  const people = await withUserRLS((tx) =>
    tx
      .select({
        id: connections.id,
        email: connections.email,
        altEmails: connections.altEmails,
      })
      .from(connections),
  );

  const targets: Target[] = people
    .map((p) => ({ connectionId: p.id, addresses: addressesFor(p) }))
    .filter((t) => t.addresses.length > 0);

  if (targets.length === 0) {
    await stampSynced(ownerId);
    return { scanned: 0, threads: 0, matched: 0, truncated: false };
  }

  let truncated = false;

  // Phase 1 — search. One list call per address, bounded concurrency.
  const searches = targets.flatMap((t) =>
    t.addresses.map((address) => ({ connectionId: t.connectionId, address })),
  );

  const found = await mapLimit(searches, CONCURRENCY, async (s) => {
    const ids = await listThreadIds(
      accessToken,
      addressQuery(s.address, WINDOW_DAYS),
      MAX_THREADS_PER_ADDRESS,
      signal,
    );
    if (ids.length === MAX_THREADS_PER_ADDRESS) truncated = true;
    return { connectionId: s.connectionId, ids };
  });

  // A person's several addresses can land on the same thread (they replied from
  // work, we cc'd their personal). Union per connection so we store one row.
  const idsByConnection = new Map<string, Set<string>>();
  for (const f of found) {
    const set = idsByConnection.get(f.connectionId) ?? new Set<string>();
    for (const id of f.ids) set.add(id);
    idsByConnection.set(f.connectionId, set);
  }

  // Phase 2 — fetch each (connection, thread) pair and summarize.
  const pairs = [...idsByConnection].flatMap(([connectionId, ids]) =>
    [...ids].map((threadId) => ({ connectionId, threadId })),
  );

  const rows = await mapLimit(pairs, CONCURRENCY, async (p) => {
    const thread = await getThread(accessToken, p.threadId, signal);
    const summary = summarize(thread, selfAddress);
    if (!summary) return null;
    return {
      ownerId,
      connectionId: p.connectionId,
      threadId: p.threadId,
      ...summary,
    };
  });

  const values = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  if (values.length === 0) {
    await stampSynced(ownerId);
    return { scanned: targets.length, threads: 0, matched: 0, truncated };
  }

  // Phase 3 — persist. Which connections already had threads, so "matched" can
  // report genuinely new links rather than re-counting the same people each run.
  const matched = await withUserRLS(async (tx) => {
    const touched = [...new Set(values.map((v) => v.connectionId))];
    const before = await tx
      .select({ connectionId: emailThreads.connectionId })
      .from(emailThreads)
      .where(inArray(emailThreads.connectionId, touched));
    const had = new Set(before.map((b) => b.connectionId));

    await tx
      .insert(emailThreads)
      .values(values)
      .onConflictDoUpdate({
        target: [
          emailThreads.ownerId,
          emailThreads.connectionId,
          emailThreads.threadId,
        ],
        set: {
          subject: sqlExcluded("subject"),
          snippet: sqlExcluded("snippet"),
          lastMessageAt: sqlExcluded("last_message_at"),
          messageCount: sqlExcluded("message_count"),
          direction: sqlExcluded("direction"),
          updatedAt: new Date(),
        },
      });

    return touched.filter((id) => !had.has(id)).length;
  });

  await stampSynced(ownerId);

  return { scanned: targets.length, threads: values.length, matched, truncated };
}

/** Record that a sweep completed, so Settings can show how fresh the mirror is. */
async function stampSynced(ownerId: string): Promise<void> {
  await db
    .update(googleAccounts)
    .set({ lastSyncedAt: new Date() })
    .where(eq(googleAccounts.ownerId, ownerId));
}

/** `excluded.<col>` — the incoming row's value in an upsert's DO UPDATE clause. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
