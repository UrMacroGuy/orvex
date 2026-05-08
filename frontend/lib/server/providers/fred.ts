export interface FredSeriesPoint {
  series_id: string;
  label: string;
  value: number;
  previous_value: number | null;
  change: number | null;
  unit: string;
  date: string;
}

export interface MacroOverlay {
  summary: string[];
  series: FredSeriesPoint[];
}

const SERIES = [
  { id: "CPIAUCSL", label: "CPI", unit: "index" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
  { id: "UNRATE", label: "Unemployment Rate", unit: "%" },
  { id: "DGS10", label: "10Y Treasury Yield", unit: "%" },
  { id: "DGS2", label: "2Y Treasury Yield", unit: "%" },
] as const;

async function fetchFredCsv(seriesId: string) {
  const response = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
    {
      headers: {
        "User-Agent": "Orvex/1.0",
      },
      next: { revalidate: 3600 },
    },
  );

  if (!response.ok) {
    throw new Error(`FRED request failed: ${response.status}`);
  }

  return response.text();
}

function parseLatestSeriesPoint(csv: string, seriesId: string, label: string, unit: string): FredSeriesPoint | null {
  const rows = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((row) => row.split(","))
    .filter((row) => row.length >= 2 && row[1] !== "." && row[1] !== "");

  if (rows.length === 0) {
    return null;
  }

  const latest = rows[rows.length - 1];
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  const latestValue = Number(latest[1]);
  const previousValue = previous ? Number(previous[1]) : null;

  return {
    series_id: seriesId,
    label,
    value: latestValue,
    previous_value: previousValue,
    change: previousValue === null ? null : latestValue - previousValue,
    unit,
    date: latest[0],
  };
}

export async function getMacroOverlay(): Promise<MacroOverlay> {
  const series = (
    await Promise.all(
      SERIES.map(async (item) =>
        parseLatestSeriesPoint(await fetchFredCsv(item.id), item.id, item.label, item.unit),
      ),
    )
  ).filter((item): item is FredSeriesPoint => Boolean(item));

  const tenYear = series.find((item) => item.series_id === "DGS10");
  const twoYear = series.find((item) => item.series_id === "DGS2");
  const spread =
    tenYear && twoYear ? Number((tenYear.value - twoYear.value).toFixed(2)) : null;

  const summary = [
    ...series.map((item) => {
      const delta =
        item.change === null ? "flat vs prior print" : `${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)} ${item.unit} vs prior print`;
      return `${item.label}: ${item.value.toFixed(2)} ${item.unit} (${delta}) as of ${item.date}.`;
    }),
  ];

  if (spread !== null) {
    summary.push(`10Y-2Y Treasury spread: ${spread.toFixed(2)} percentage points.`);
  }

  return {
    summary,
    series,
  };
}
