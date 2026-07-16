import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/data/session";
import { getGoogleIntegration } from "@/lib/data/integrations";

/** Read the signed-in user's Google link. Backs the `useGoogleIntegration` SWR hook. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  return NextResponse.json(await getGoogleIntegration());
}
