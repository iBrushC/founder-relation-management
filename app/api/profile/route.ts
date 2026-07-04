import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/data/session";
import { getProfile } from "@/lib/data/profiles";

/** Read the signed-in user's profile. Backs the client-side `useProfile` SWR hook. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const profile = await getProfile();
  return NextResponse.json(profile);
}
