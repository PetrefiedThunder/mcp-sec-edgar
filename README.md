# mcp-sec-edgar

Search SEC EDGAR for company filings, financial statements, and insider transactions.

> **Free API** — No API key required.

## Tools

| Tool | Description |
|------|-------------|
| `search_filings` | Full-text search across SEC EDGAR filings. Search for keywords in filing documents. |
| `search_companies` | Search for companies in SEC EDGAR by name or CIK number. |
| `get_company_filings` | Get recent filings for a company by CIK number. Returns filing metadata including form type, date, and document references. |
| `get_filing_content` | Retrieve the content of a specific SEC filing document. Without a document name, returns the filing index listing available documents. |
| `get_company_facts` | Get XBRL financial facts for a company (revenue, assets, net income, etc). Without a fact name, lists all available facts. |
| `get_insider_trades` | Get insider trading filings (Forms 3, 4, 5) for a company. Shows recent insider buys, sells, and ownership changes. |

## Installation

```bash
git clone https://github.com/PetrefiedThunder/mcp-sec-edgar.git
cd mcp-sec-edgar
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sec-edgar": {
      "command": "node",
      "args": ["/path/to/mcp-sec-edgar/dist/index.js"]
    }
  }
}
```

## Usage with npx

```bash
npx mcp-sec-edgar
```

## License

MIT
