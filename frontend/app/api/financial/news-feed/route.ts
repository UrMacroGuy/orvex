import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getGlobalNewsFeed, type NewsCategory } from "@/lib/server/providers/global-news-feed";

export const runtime = "nodejs";
export const revalidate = 300; // 5-minute cache at edge

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser();

    const { searchParams } = request.nextUrl;
    const category = (searchParams.get("category") ?? "all") as NewsCategory;
    const limit = Math.min(Number(searchParams.get("limit") ?? "60"), 100);

    const result = await getGlobalNewsFeed({ category, limit });

    return NextResponse.json({ data: result }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch news feed";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
