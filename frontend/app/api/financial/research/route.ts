import { NextResponse } from "next/server";
import {
  ensureProfile,
  getRouteError,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { createResearchQuery, listResearchQueries } from "@/lib/server/research";
import type { FinancialQuery, ModelSelection } from "@/types/financial";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await ensureProfile(user);
    const body = (await request.json()) as FinancialQuery;
    const selectedModels: ModelSelection[] =
      Array.isArray(body.selected_models) && body.selected_models.length > 0
        ? body.selected_models
        : [{ provider_id: "orvex", model_id: "open-web-intelligence" }];

    if (!body.query) {
      return NextResponse.json(
        { error: { message: "query is required" } },
        { status: 400 },
      );
    }

    const created = await createResearchQuery({
      userId: user.id,
      query: {
        ...body,
        selected_models: selectedModels,
      },
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
    const user = await requireAuthenticatedUser();
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
