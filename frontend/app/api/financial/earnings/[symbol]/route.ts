import { NextResponse } from "next/server";
import { getRouteError, requireAuthenticatedUser } from "@/lib/server/auth";
import { getEarnings } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "8");
    const { symbol } = await context.params;
    const earnings = await getEarnings(symbol.toUpperCase(), limit);
    return NextResponse.json({ data: earnings });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to fetch earnings");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
