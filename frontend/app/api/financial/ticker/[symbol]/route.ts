import { NextResponse } from "next/server";
import { getRouteError, requireAuthenticatedUser } from "@/lib/server/auth";
import { getQuote } from "@/lib/server/providers/market";

export const runtime = "nodejs";

function formatMarketCap(val: number | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  return `$${val.toLocaleString()}`;
}

function formatVolume(val: number | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return String(val);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    await requireAuthenticatedUser();
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
          market_cap: formatMarketCap(quote.market_cap),
          pe_ratio: quote.pe_ratio ?? undefined,
          fifty_two_week_high: quote.fifty_two_week_high ?? undefined,
          fifty_two_week_low: quote.fifty_two_week_low ?? undefined,
          avg_volume: formatVolume(quote.volume),
          after_hours_price: quote.after_hours_price ?? undefined,
          after_hours_change_percent: quote.after_hours_change_percent ?? undefined,
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
