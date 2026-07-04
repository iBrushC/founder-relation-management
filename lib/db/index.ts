import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/drizzle/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set (see .env.local).");

// The DATABASE_URL points at Supabase's transaction pooler (port 6543), which
// does not support prepared statements — hence `prepare: false`.
const client = postgres(connectionString, { prepare: false });

/**
 * Trusted Drizzle client. It connects through the pooler's `postgres` role,
 * which BYPASSES Row Level Security. Use it only for server-side work that
 * intentionally operates across users (admin tasks, jobs, provisioning).
 *
 * For anything acting on behalf of the signed-in user, go through
 * `withUserRLS` in ./rls so Postgres enforces the profiles policies for you.
 */
export const db = drizzle(client, { schema });

export type Database = typeof db;
export { schema };
