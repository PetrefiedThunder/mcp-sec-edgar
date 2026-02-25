import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocking
const {
  searchFilings,
  searchCompanies,
  getCompanyFilings,
  getCompanyFacts,
  getInsiderTrades,
  getFilingContent,
} = await import("../src/edgar-client.js");

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function textResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    text: () => Promise.resolve(text),
  };
}

describe("searchFilings", () => {
  it("sends correct query params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ hits: { total: 0, hits: [] } }));
    await searchFilings({ query: "AI", forms: "10-K", startDate: "2024-01-01" });

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get("q")).toBe("AI");
    expect(url.searchParams.get("forms")).toBe("10-K");
    expect(url.searchParams.get("dateRange")).toBe("custom");
    expect(url.searchParams.get("startdt")).toBe("2024-01-01");
  });

  it("includes User-Agent header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    await searchFilings({ query: "test" });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["User-Agent"]).toContain("SkywalkerAgent");
  });
});

describe("getCompanyFilings", () => {
  it("pads CIK to 10 digits", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        cik: "320193",
        name: "Apple Inc.",
        tickers: ["AAPL"],
        filings: {
          recent: {
            accessionNumber: ["0000320193-24-000001"],
            form: ["10-K"],
            filingDate: ["2024-01-15"],
            primaryDocument: ["doc.htm"],
            primaryDocDescription: ["Annual Report"],
          },
        },
      })
    );

    const result = await getCompanyFilings({ cik: "320193" });
    expect(mockFetch.mock.calls[0][0]).toContain("CIK0000320193.json");
    expect(result.name).toBe("Apple Inc.");
    expect(result.recentFilings).toHaveLength(1);
    expect(result.recentFilings[0].form).toBe("10-K");
  });
});

describe("getCompanyFacts", () => {
  it("lists available facts when no fact specified", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        cik: 320193,
        entityName: "Apple Inc.",
        facts: {
          "us-gaap": { Revenues: {}, Assets: {} },
          dei: { EntityCommonStockSharesOutstanding: {} },
        },
      })
    );

    const result = await getCompanyFacts({ cik: "320193" });
    expect(result.availableFacts?.["us-gaap"]).toContain("Revenues");
  });

  it("returns specific fact data", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        cik: 320193,
        entityName: "Apple Inc.",
        facts: {
          "us-gaap": {
            Revenues: { units: { USD: [{ val: 1000000 }] } },
          },
        },
      })
    );

    const result = await getCompanyFacts({ cik: "320193", fact: "Revenues" });
    expect(result.fact).toBe("Revenues");
    expect(result.data).toBeDefined();
  });
});

describe("getInsiderTrades", () => {
  it("filters for forms 3, 4, 5", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        cik: "320193",
        name: "Apple Inc.",
        filings: {
          recent: {
            form: ["10-K", "4", "8-K", "4", "3"],
            filingDate: ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
            accessionNumber: ["a1", "a2", "a3", "a4", "a5"],
            primaryDocument: ["d1", "d2", "d3", "d4", "d5"],
            reportDate: ["r1", "r2", "r3", "r4", "r5"],
          },
        },
      })
    );

    const result = await getInsiderTrades({ cik: "320193" });
    expect(result.trades).toHaveLength(3);
    expect(result.trades.every((t: any) => ["3", "4", "5"].includes(t.form))).toBe(true);
  });
});

describe("searchCompanies", () => {
  it("parses Atom XML response", async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse(`<?xml version="1.0"?>
<feed>
  <entry>
    <title>APPLE INC</title>
    <link href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&amp;CIK=320193"/>
    <content type="text">State location: CA</content>
  </entry>
</feed>`)
    );

    const result = await searchCompanies({ company: "apple" });
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe("APPLE INC");
    expect(result.companies[0].cik).toBe("320193");
  });
});

describe("getFilingContent", () => {
  it("fetches filing index when no document specified", async () => {
    mockFetch.mockResolvedValueOnce(
      textResponse(`<table><tr><td>1</td><td>Annual Report</td><td>report.htm</td><td>10-K</td></tr></table>`)
    );

    const result = await getFilingContent({
      accessionNumber: "0000320193-24-000001",
      cik: "320193",
    });
    expect(result.indexUrl).toContain("0000320193-24-000001-index.htm");
  });
});

describe("rate limiting", () => {
  it("spaces requests at least 100ms apart", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ hits: { total: 0 } }));
    const start = Date.now();
    await searchFilings({ query: "a" });
    await searchFilings({ query: "b" });
    await searchFilings({ query: "c" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(180); // ~200ms for 2 waits
  });
});

describe("error handling", () => {
  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("not found"),
    });

    await expect(searchFilings({ query: "test" })).rejects.toThrow("EDGAR API error 404");
  });
});
