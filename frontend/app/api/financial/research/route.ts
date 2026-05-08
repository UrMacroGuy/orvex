import { NextResponse } from "next/server";
import {
  ensureProfile,
  getRouteError,
  requireProviderAccess,
} from "@/lib/server/auth";
import { createResearchQuery, listResearchQueries } from "@/lib/server/research";
import type { FinancialQuery } from "@/types/financial";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireProviderAccess();
    await ensureProfile(user);
    const body = (await request.json()) as FinancialQuery;

    if (!body.query || !Array.isArray(body.selected_models) || body.selected_models.length === 0) {
      return NextResponse.json(
        { error: { message: "query and selected_models are required" } },
        { status: 400 },
      );
    }

    const created = await createResearchQuery({
      userId: user.id,
      query: body,
    });

    return NextResponse.json({ data: { id: created.id } }, { status: 201 });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to create research");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}

export async function GET() {
  try {
    const user = await requireProviderAccess();
    const queries = await listResearchQueries(user.id);
    return NextResponse.json({ data: { items: queries, next_cursor: null } });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to list research");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
