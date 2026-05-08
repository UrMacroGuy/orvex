export interface SecFiling {
  accession_number: string;
  filing_date: string;
  form: string;
  primary_document: string;
  filing_url: string;
}

export interface SecCompanyOverview {
  cik: string;
  ticker: string;
  company_name: string;
  sic_description: string | null;
  filings: SecFiling[];
  insider_activity: SecFiling[];
}

export interface SecRiskSummary {
  filing: SecFiling | null;
  extracted_text: string | null;
  risk_factors: string[];
}

async function secFetch<T>(url: string, revalidate = 3600): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Orvex/1.0 support@orvex.app",
      Accept: "application/json, text/plain;q=0.8",
    },
    next: { revalidate },
  });

  if (!response.ok) {
    throw new Error(`SEC request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as Promise<T>;
}

async function resolveTickerToCik(symbol: string) {
  const mapping = await secFetch<
    Record<
      string,
      { ticker?: string; cik_str?: number; title?: string }
    >
  >("https://www.sec.gov/files/company_tickers.json", 86_400);

  const match = Object.values(mapping).find(
    (item) => item.ticker?.toUpperCase() === symbol.toUpperCase(),
  );

  if (!match?.cik_str || !match.ticker || !match.title) {
    return null;
  }

  return {
    cik: String(match.cik_str).padStart(10, "0"),
    ticker: match.ticker,
    company_name: match.title,
  };
}

function buildFilingUrl(cik: string, accessionNumber: string, primaryDocument: string) {
  const compactAccession = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${compactAccession}/${primaryDocument}`;
}

function normalizeFiling(cik: string, index: number, recent: Record<string, unknown[]>): SecFiling {
  const accessionNumber = String(recent.accessionNumber?.[index] ?? "");
  const filingDate = String(recent.filingDate?.[index] ?? "");
  const form = String(recent.form?.[index] ?? "");
  const primaryDocument = String(recent.primaryDocument?.[index] ?? "");

  return {
    accession_number: accessionNumber,
    filing_date: filingDate,
    form,
    primary_document: primaryDocument,
    filing_url: buildFilingUrl(cik, accessionNumber, primaryDocument),
  };
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRiskFactorSection(text: string) {
  const normalized = stripHtml(text);
  const match = normalized.match(
    /Item\s+1A\.?\s+Risk Factors([\s\S]{600,20000}?)(?:Item\s+1B\.|Item\s+2\.|Item\s+2A\.|Item\s+3\.)/i,
  );

  return match?.[1]?.trim() ?? null;
}

function summarizeRiskFactors(section: string | null) {
  if (!section) {
    return [];
  }

  return section
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 80)
    .slice(0, 6);
}

export async function getSecCompanyOverview(symbol: string): Promise<SecCompanyOverview | null> {
  const company = await resolveTickerToCik(symbol);
  if (!company) {
    return null;
  }

  const submissions = await secFetch<{
    sicDescription?: string;
    filings?: {
      recent?: Record<string, unknown[]>;
    };
  }>(
    `https://data.sec.gov/submissions/CIK${company.cik}.json`,
  );

  const recent = submissions.filings?.recent;
  if (!recent) {
    return {
      cik: company.cik,
      ticker: company.ticker,
      company_name: company.company_name,
      sic_description: submissions.sicDescription ?? null,
      filings: [],
      insider_activity: [],
    };
  }

  const filingCount = recent.form?.length ?? 0;
  const filings = Array.from({ length: filingCount }, (_, index) => normalizeFiling(company.cik, index, recent))
    .filter((filing) => ["10-K", "10-Q", "8-K"].includes(filing.form))
    .slice(0, 10);

  const insiderActivity = Array.from({ length: filingCount }, (_, index) => normalizeFiling(company.cik, index, recent))
    .filter((filing) => ["3", "4", "5"].includes(filing.form))
    .slice(0, 10);

  return {
    cik: company.cik,
    ticker: company.ticker,
    company_name: company.company_name,
    sic_description: submissions.sicDescription ?? null,
    filings,
    insider_activity: insiderActivity,
  };
}

export async function getSecRiskSummary(symbol: string): Promise<SecRiskSummary> {
  const overview = await getSecCompanyOverview(symbol);
  const filing = overview?.filings.find((item) => item.form === "10-K") ?? overview?.filings[0] ?? null;

  if (!filing?.filing_url) {
    return {
      filing: null,
      extracted_text: null,
      risk_factors: [],
    };
  }

  const filingText = await secFetch<string>(filing.filing_url, 86_400);
  const extractedText = extractRiskFactorSection(filingText);

  return {
    filing,
    extracted_text: extractedText,
    risk_factors: summarizeRiskFactors(extractedText),
  };
}
