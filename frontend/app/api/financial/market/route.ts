import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getMarketSnapshot } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const data = await getMarketSnapshot();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch market snapshot";
    return NextResponse.json(
      { error: { message } },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
