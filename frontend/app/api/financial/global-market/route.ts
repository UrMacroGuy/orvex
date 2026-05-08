import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getGlobalMarketData } from "@/lib/server/providers/global-market";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const data = await getGlobalMarketData();
    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch global market data";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
