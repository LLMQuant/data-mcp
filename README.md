<p align="center">
  <a href="https://llmquantdata.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg" />
      <img alt="LLMQuant Data" src="./assets/logo.svg" width="120" />
    </picture>
  </a>
</p>

<h3 align="center">@llmquant/data-mcp</h3>

<p align="center">
  The knowledge harness for AI‑native finance.<br/>
  <a href="https://llmquantdata.com">Website</a> · <a href="https://llmquantdata.com/docs">Docs</a> · <a href="./README.zh-CN.md">中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@llmquant/data-mcp"><img src="https://img.shields.io/npm/v/@llmquant/data-mcp" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@llmquant/data-mcp"><img src="https://img.shields.io/npm/dm/@llmquant/data-mcp" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@llmquant/data-mcp" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@llmquant/data-mcp" alt="node version" /></a>
</p>

---

Context engineering meets financial data — structured for agent context, not human browsing.

## Table of Contents

- [What It Does](#what-it-does)
- [Available Tools](#available-tools)
- [Try It Out](#try-it-out)
- [Client Setup](#client-setup)
- [Environment Variables](#environment-variables)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## What It Does

This is an MCP server for [LLMQuant Data](https://llmquantdata.com). It connects any AI agent to financial data — wiki articles, research papers, crypto & equity prices, macro indicators, SEC filings, and more — through the [Model Context Protocol](https://modelcontextprotocol.io).

Configure once — every agent in your stack gets the data.

<p align="center">
  <img src="./assets/agent-harness.png" alt="Available in every agent harness" width="720" />
</p>

> [!TIP]
> We're also building **llmquantdata-skills** — a companion set of agent skills that combine these data tools into ready‑made AI‑native financial workflows (equity research, macro analysis, etc.). Stay tuned.

## Available Tools

> [!NOTE]
> The credit model is in **beta** — amounts below may change. Sign up at [llmquantdata.com](https://llmquantdata.com) for free credits, no credit card required.

| Tool | Description | Credit |
|------|-------------|--------|
| `wiki_search` | Semantic search over 50,000+ quant wiki entries | 1 |
| `wiki_read` | Read a wiki article by ID | 0 |
| `paper_search` | Semantic search over 1,200+ research papers | 1 |
| `paper_read` | Read paper sections (intro, methods, conclusion, …) | 0 |
| `crypto_historical_klines` | Crypto OHLCV candlestick data (Binance Spot) | 1 |
| `crypto_snapshot` | Current crypto price + 24h stats | 1 |
| `equity_historical_prices` | US equity daily OHLCV + dividend/split data | 1 |
| `macro_indicator_search` | Browse 50+ curated macro indicators (FRED, etc.) | 0 |
| `macro_indicator_history` | Historical observations for a macro indicator | 1 |
| `macro_indicator_snapshot` | Latest value for a macro indicator | 1 |
| `sec_filing_browse` | Browse SEC 10-K / 10-Q filing metadata | 0 |
| `sec_filing_read` | Read section text from a SEC filing | 1 |
| `sec_13f_list_manager_holdings` | List an institutional manager's 13F holdings (Top 1000 × last 4 quarters) | 1 |
| `sec_13f_list_ticker_holders` | List institutional holders of a ticker (Top 1000 × last 4 quarters) | 1 |
| `sec_13f_list_top_managers` | List the top N smart money managers ranked by 13F reportable value (latest quarter, up to 1000) | 1 |

> More data products (news, company fundamentals, earnings transcripts, etc.) are on the [roadmap](#roadmap).

Four ways to access each data product:

<p align="center">
  <img src="./assets/data-access.png" alt="Four data access patterns — source data, semantic search, PageIndex tree, knowledge graph" width="720" />
</p>

## Try It Out

Launch the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to explore tools interactively in your browser:

```bash
export LLMQUANT_API_KEY=your_api_key
npx @modelcontextprotocol/inspector npx -y @llmquant/data-mcp
```

> [!NOTE]
> To persist the key, add `export LLMQUANT_API_KEY=your_api_key` to your `~/.zshrc` or `~/.bashrc`.

<p align="center">
  <img src="./assets/mcp-inspector.png" alt="MCP Inspector — interactively test tools in your browser" width="720" />
</p>

> [!TIP]
> You'll need an API key — sign up free at [llmquantdata.com](https://llmquantdata.com).

## Client Setup

### Claude Code

```bash
claude mcp add llmquant-data \
  -e LLMQUANT_API_KEY=your_api_key \
  -- npx -y @llmquant/data-mcp
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "llmquant-data": {
      "command": "npx",
      "args": ["-y", "@llmquant/data-mcp"],
      "env": {
        "LLMQUANT_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Codex CLI

```bash
codex mcp add llmquant-data \
  --env LLMQUANT_API_KEY=your_api_key \
  -- npx -y @llmquant/data-mcp
```

### Gemini CLI

```bash
gemini mcp add -s user \
  -e LLMQUANT_API_KEY=your_api_key \
  llmquant-data \
  -- npx -y @llmquant/data-mcp
```

### Other MCP Clients

Any client supporting stdio transport can use this JSON config:

```json
{
  "mcpServers": {
    "llmquant-data": {
      "command": "npx",
      "args": ["-y", "@llmquant/data-mcp"],
      "env": {
        "LLMQUANT_API_KEY": "your_api_key"
      }
    }
  }
}
```

> [!NOTE]
> We're working on integration guides for more clients. If your agent framework isn't listed, [open an issue](https://github.com/LLMQuant/data-mcp/issues) and we'll add it.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLMQUANT_API_KEY` | Yes | — | Your API key |
| `LLMQUANT_BASE_URL` | No | `https://api.llmquantdata.com` | API base URL |
| `LLMQUANT_API_TIMEOUT_MS` | No | `15000` | Request timeout in ms (max 120000) |

## Roadmap

- [ ] Streamable HTTP transport (remote MCP without local Node.js)
- [ ] More data products — news, company fundamentals, earnings transcripts
- [ ] Agent skills companion package (**llmquantdata-skills**)
- [ ] Integration guides for more agent frameworks

Have a feature request? [Open an issue](https://github.com/LLMQuant/data-mcp/issues) or email us at **contact@llmquant.com**.

## Contributing

This repository is a **read-only mirror**. We do not accept pull requests.

Found a bug or have a feature request? Please [open an issue](https://github.com/LLMQuant/data-mcp/issues) — we actively triage and respond.

## License

[MIT](./LICENSE)
