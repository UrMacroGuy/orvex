import { NextResponse } from "next/server";
import { getRouteError, requireProviderAccess } from "@/lib/server/auth";
import { getResearchResult } from "@/lib/server/research";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ queryId: string }> },
) {
  try {
    const user = await requireProviderAccess();
    const { queryId } = await context.params;
    const result = await getResearchResult(user.id, queryId);

    if (!result) {
      return NextResponse.json({ error: { message: "query not found" } }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to fetch research");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
