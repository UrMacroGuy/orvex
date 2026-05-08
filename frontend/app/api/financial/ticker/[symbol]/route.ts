import { NextResponse } from "next/server";
import { getRouteError, requireProviderAccess } from "@/lib/server/auth";
import { getQuote } from "@/lib/server/providers/market";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    await requireProviderAccess();
    const { symbol } = await context.params;
    const quote = await getQuote(symbol.toUpperCase());

    if (!quote) {
      return NextResponse.json({ error: { message: "ticker not found" } }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ticker: symbol.toUpperCase(),
        stock_data: {
          ticker: symbol.toUpperCase(),
          price: quote.current_price,
          change_percent: quote.change_percent,
          fifty_two_week_high: quote.high_price,
          fifty_two_week_low: quote.low_price,
          avg_volume: quote.volume ? String(quote.volume) : undefined,
        },
      },
    });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to fetch ticker");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
