import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { searchTickers } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const limit = Number(searchParams.get("limit") ?? "10");

    if (!q) {
      return NextResponse.json({ error: { message: "q is required" } }, { status: 400 });
    }

    const data = await searchTickers(q, limit);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search tickers";
    return NextResponse.json(
      { error: { message } },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
