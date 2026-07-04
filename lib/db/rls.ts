import "server-only";

import { sql } from "drizzle-orm";

import { verifySession } from "@/lib/data/session";
import { db } from "./index";

/** The transaction handle Drizzle hands to a `db.transaction` callback. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run queries as the signed-in user with Postgres RLS enforced.
 *
 * The pooler's `postgres` role bypasses RLS, so we open a transaction, drop
 * into the `authenticated` role, and set the JWT claims Supabase policies read
 * (`auth.uid()` resolves to `request.jwt.claims ->> 'sub'`). `set_config(..., true)`
 * scopes every setting to the transaction, and the role resets when it ends.
 *
 * The session is revalidated against Supabase Auth first (layer 3, the DAL), so
 * `userId` is trusted — we build minimal claims from it rather than replaying a
 * raw client token.
 *
 * @example
 *   const rows = await withUserRLS((tx) =>
 *     tx.select().from(profiles).where(eq(profiles.id, userId)),
 *   );
 */
export async function withUserRLS<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  const { userId } = await verifySession();
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });

  return db.transaction(async (tx) => {
    // Separate statements: the extended (parameterized) protocol allows only one
    // command per query, so we can safely bind values instead of interpolating.
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return run(tx);
  });
}
