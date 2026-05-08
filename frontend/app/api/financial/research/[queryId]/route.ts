import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getResearchResult } from "@/lib/server/research";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ queryId: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { queryId } = await context.params;
    const result = await getResearchResult(user.id, queryId);

    if (!result) {
      return NextResponse.json({ error: { message: "query not found" } }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch research";
    return NextResponse.json(
      { error: { message } },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
