import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getCompanyProfile } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { symbol } = await context.params;
    const company = await getCompanyProfile(symbol.toUpperCase());

    if (!company) {
      return NextResponse.json({ error: { message: "company not found" } }, { status: 404 });
    }

    return NextResponse.json({ data: company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch company";
    return NextResponse.json(
      { error: { message } },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
