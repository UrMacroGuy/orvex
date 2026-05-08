import { NextResponse } from "next/server";
import { getRouteError, requireProviderAccess } from "@/lib/server/auth";
import { getMarketSnapshot } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireProviderAccess();
    const data = await getMarketSnapshot();
    return NextResponse.json({ data });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to fetch market snapshot");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
