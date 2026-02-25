# mcp-sec-edgar

MCP server that wraps the [SEC EDGAR API](https://www.sec.gov/edgar/sec-api-documentation) for AI agents. No API key required.

## Tools

| Tool | Description |
|------|-------------|
| `search_filings` | Full-text search across SEC filing documents |
| `search_companies` | Find companies by name or CIK |
| `get_company_filings` | List recent filings for a company |
| `get_filing_content` | Retrieve filing document content |
| `get_company_facts` | XBRL financial data (revenue, assets, etc.) |
| `get_insider_trades` | Insider trading filings (Forms 3, 4, 5) |

## Setup

```bash
npm install
npm run build
```

## Usage

### With Claude Desktop

Add to `claude_desktop_config.json`:

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

### With OpenClaw

```json
{
  "command": "node",
  "args": ["/path/to/mcp-sec-edgar/dist/index.js"]
}
```

### Development

```bash
npm run dev     # Run with tsx
npm test        # Run tests
```

## Examples

- Search for AI-related 10-K filings: `search_filings({ query: "artificial intelligence", forms: "10-K" })`
- Look up Apple's financials: `get_company_facts({ cik: "320193", fact: "Revenues" })`
- Check insider trades: `get_insider_trades({ cik: "320193" })`

## Rate Limiting

Respects SEC EDGAR's 10 requests/second limit automatically.

## License

MIT
