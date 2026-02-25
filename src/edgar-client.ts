/**
 * SEC EDGAR API client with rate limiting (10 req/s).
 */

const USER_AGENT = "SkywalkerAgent chris.sellers01@gmail.com";
const RATE_LIMIT_MS = 100; // 10 req/s

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, headers?: Record<string, string>): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EDGAR API error ${res.status}: ${res.statusText}\n${body.slice(0, 500)}`);
  }

  return res;
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, "").padStart(10, "0");
}

// ── Search filings (full-text search) ──

export interface SearchFilingsParams {
  query: string;
  forms?: string;
  startDate?: string;
  endDate?: string;
  from?: number;
  size?: number;
}

export async function searchFilings(params: SearchFilingsParams) {
  const url = new URL("https://efts.sec.gov/LATEST/search-index");
  url.searchParams.set("q", params.query);
  if (params.forms) url.searchParams.set("forms", params.forms);
  if (params.startDate || params.endDate) {
    url.searchParams.set("dateRange", "custom");
    if (params.startDate) url.searchParams.set("startdt", params.startDate);
    if (params.endDate) url.searchParams.set("enddt", params.endDate);
  }
  if (params.from !== undefined) url.searchParams.set("from", String(params.from));
  if (params.size !== undefined) url.searchParams.set("size", String(params.size));

  const res = await rateLimitedFetch(url.toString());
  return res.json();
}

// ── Search companies ──

export interface SearchCompaniesParams {
  company?: string;
  cik?: string;
  type?: string;
  count?: number;
}

export async function searchCompanies(params: SearchCompaniesParams) {
  // Use the EDGAR company tickers JSON for cleaner results
  const url = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  url.searchParams.set("action", "getcompany");
  url.searchParams.set("output", "atom");
  if (params.company) url.searchParams.set("company", params.company);
  if (params.cik) url.searchParams.set("CIK", params.cik);
  if (params.type) url.searchParams.set("type", params.type);
  url.searchParams.set("owner", "include");
  url.searchParams.set("count", String(params.count ?? 40));

  const res = await rateLimitedFetch(url.toString(), { Accept: "application/atom+xml" });
  const text = await res.text();

  // Parse Atom XML into simplified results
  const entries: Array<{ name: string; cik: string; location: string }> = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(text)) !== null) {
    const entry = match[1];
    const name = entry.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.trim() ?? "";
    const cik = entry.match(/CIK=(\d+)/)?.[1] ?? "";
    const location = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1]
      ?.match(/State location:\s*(\w+)/i)?.[1] ?? "";
    if (cik) entries.push({ name, cik, location });
  }

  return { total: entries.length, companies: entries };
}

// ── Get company filings ──

export interface GetCompanyFilingsParams {
  cik: string;
}

export async function getCompanyFilings(params: GetCompanyFilingsParams) {
  const cik = padCik(params.cik);
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const res = await rateLimitedFetch(url);
  const data = await res.json() as any;

  const recent = data.filings?.recent ?? {};
  const filings = (recent.accessionNumber ?? []).map((_: string, i: number) => ({
    accessionNumber: recent.accessionNumber[i],
    form: recent.form?.[i],
    filingDate: recent.filingDate?.[i],
    primaryDocument: recent.primaryDocument?.[i],
    primaryDocDescription: recent.primaryDocDescription?.[i],
  }));

  return {
    cik: data.cik,
    name: data.name,
    tickers: data.tickers,
    sic: data.sic,
    sicDescription: data.sicDescription,
    totalFilings: filings.length,
    recentFilings: filings.slice(0, 50),
  };
}

// ── Get filing content ──

export interface GetFilingContentParams {
  accessionNumber: string;
  cik: string;
  document?: string;
}

export async function getFilingContent(params: GetFilingContentParams) {
  const cik = padCik(params.cik);
  const accession = params.accessionNumber.replace(/-/g, "");
  const accessionDashed = params.accessionNumber;

  if (params.document) {
    const url = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, "")}/${accession}/${params.document}`;
    const res = await rateLimitedFetch(url, { Accept: "text/html, text/plain, */*" });
    const text = await res.text();
    // Strip HTML tags for readability
    const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { url, content: clean.slice(0, 50000) };
  }

  // Fetch the filing index
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, "")}/${accession}/${accessionDashed}-index.htm`;
  const res = await rateLimitedFetch(indexUrl, { Accept: "text/html" });
  const text = await res.text();

  // Extract document links
  const docs: Array<{ name: string; description: string }> = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRegex.exec(text)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (c) => c[1].replace(/<[^>]+>/g, "").trim()
    );
    if (cells.length >= 4 && cells[2]) {
      docs.push({ name: cells[2], description: cells[1] || cells[3] || "" });
    }
  }

  return { indexUrl, documents: docs };
}

// ── Get company facts (XBRL) ──

export interface GetCompanyFactsParams {
  cik: string;
  fact?: string;
}

export async function getCompanyFacts(params: GetCompanyFactsParams) {
  const cik = padCik(params.cik);
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const res = await rateLimitedFetch(url);
  const data = await res.json() as any;

  if (params.fact) {
    // Search for a specific fact across taxonomies
    for (const [taxonomy, facts] of Object.entries(data.facts ?? {}) as any) {
      if (facts[params.fact]) {
        return {
          cik: data.cik,
          entityName: data.entityName,
          taxonomy,
          fact: params.fact,
          data: facts[params.fact],
        };
      }
    }
    return { cik: data.cik, entityName: data.entityName, error: `Fact '${params.fact}' not found` };
  }

  // Return available fact names
  const factNames: Record<string, string[]> = {};
  for (const [taxonomy, facts] of Object.entries(data.facts ?? {}) as any) {
    factNames[taxonomy] = Object.keys(facts);
  }

  return {
    cik: data.cik,
    entityName: data.entityName,
    availableFacts: factNames,
  };
}

// ── Get insider trades (Form 4) ──

export interface GetInsiderTradesParams {
  cik: string;
  limit?: number;
}

export async function getInsiderTrades(params: GetInsiderTradesParams) {
  const cik = padCik(params.cik);
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const res = await rateLimitedFetch(url);
  const data = await res.json() as any;

  const recent = data.filings?.recent ?? {};
  const trades: any[] = [];
  const limit = params.limit ?? 20;

  for (let i = 0; i < (recent.form?.length ?? 0) && trades.length < limit; i++) {
    if (recent.form[i] === "4" || recent.form[i] === "3" || recent.form[i] === "5") {
      trades.push({
        form: recent.form[i],
        filingDate: recent.filingDate[i],
        accessionNumber: recent.accessionNumber[i],
        primaryDocument: recent.primaryDocument[i],
        reportDate: recent.reportDate?.[i],
      });
    }
  }

  return {
    cik: data.cik,
    name: data.name,
    totalInsiderFilings: trades.length,
    trades,
  };
}
