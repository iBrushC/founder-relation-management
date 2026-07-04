import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Security architecture, layer 3 of 3: the Data Access Layer.
 *
 * `getSessionUser` validates the caller by revalidating their token against
 * Supabase Auth (not just reading the cookie). `cache()` dedupes it to a single
 * network call per render/request. Every DAL read/write calls one of these
 * first, so authorization always happens right next to the data.
 */
export const getSessionUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // e.g. Supabase env not configured yet — treat as signed out.
    return null;
  }
});

/** Like `getSessionUser`, but redirects to /login when there is no session. */
export const verifySession = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return { userId: user.id, email: user.email ?? "" };
});
