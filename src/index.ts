#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchFilings,
  searchCompanies,
  getCompanyFilings,
  getFilingContent,
  getCompanyFacts,
  getInsiderTrades,
} from "./edgar-client.js";

const server = new McpServer({
  name: "mcp-sec-edgar",
  version: "1.0.0",
});

// ── search_filings ──
server.tool(
  "search_filings",
  "Full-text search across SEC EDGAR filings. Search for keywords in filing documents.",
  {
    query: z.string().describe("Search query (e.g. 'artificial intelligence', 'revenue decline')"),
    forms: z.string().optional().describe("Comma-separated form types to filter (e.g. '10-K,10-Q,8-K')"),
    startDate: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
    endDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
    from: z.number().optional().describe("Pagination offset"),
    size: z.number().optional().describe("Number of results (default 10, max 100)"),
  },
  async (params) => {
    try {
      const result = await searchFilings(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── search_companies ──
server.tool(
  "search_companies",
  "Search for companies in SEC EDGAR by name or CIK number.",
  {
    company: z.string().optional().describe("Company name to search for"),
    cik: z.string().optional().describe("CIK number to look up"),
    type: z.string().optional().describe("Filing type filter (e.g. '10-K')"),
    count: z.number().optional().describe("Max results (default 40)"),
  },
  async (params) => {
    try {
      const result = await searchCompanies(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── get_company_filings ──
server.tool(
  "get_company_filings",
  "Get recent filings for a company by CIK number. Returns filing metadata including form type, date, and document references.",
  {
    cik: z.string().describe("Company CIK number (e.g. '320193' for Apple)"),
  },
  async (params) => {
    try {
      const result = await getCompanyFilings(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── get_filing_content ──
server.tool(
  "get_filing_content",
  "Retrieve the content of a specific SEC filing document. Without a document name, returns the filing index listing available documents.",
  {
    accessionNumber: z.string().describe("Filing accession number (e.g. '0000320193-24-000123')"),
    cik: z.string().describe("Company CIK number"),
    document: z.string().optional().describe("Specific document filename from the filing index"),
  },
  async (params) => {
    try {
      const result = await getFilingContent(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── get_company_facts ──
server.tool(
  "get_company_facts",
  "Get XBRL financial facts for a company (revenue, assets, net income, etc). Without a fact name, lists all available facts.",
  {
    cik: z.string().describe("Company CIK number"),
    fact: z.string().optional().describe("Specific XBRL fact name (e.g. 'Revenues', 'Assets', 'NetIncomeLoss')"),
  },
  async (params) => {
    try {
      const result = await getCompanyFacts(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── get_insider_trades ──
server.tool(
  "get_insider_trades",
  "Get insider trading filings (Forms 3, 4, 5) for a company. Shows recent insider buys, sells, and ownership changes.",
  {
    cik: z.string().describe("Company CIK number"),
    limit: z.number().optional().describe("Max number of trades to return (default 20)"),
  },
  async (params) => {
    try {
      const result = await getInsiderTrades(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-sec-edgar server running on stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
