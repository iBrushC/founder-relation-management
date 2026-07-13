import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/data/session";
import { buildSearchIndex } from "@/lib/data/search";

/** The global search index for the signed-in user. Backs the top-bar `useSearch` hook. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const items = await buildSearchIndex();
  return NextResponse.json(items);
}
