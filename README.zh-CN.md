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
  <a href="https://llmquantdata.com">官网</a> · <a href="https://llmquantdata.com/docs">文档</a> · <a href="./README.md">English</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@llmquant/data-mcp"><img src="https://img.shields.io/npm/v/@llmquant/data-mcp" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@llmquant/data-mcp"><img src="https://img.shields.io/npm/dm/@llmquant/data-mcp" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@llmquant/data-mcp" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@llmquant/data-mcp" alt="node version" /></a>
</p>

---

金融数据，为 agent context 而生 — 不是给人看的，是给 agent 用的。

## 目录

- [这是什么](#这是什么)
- [可用工具](#可用工具)
- [试一试](#试一试)
- [接入方式](#接入方式)
- [环境变量](#环境变量)
- [路线图](#路线图)
- [贡献](#贡献)
- [License](#license)

## 这是什么

[LLMQuant Data](https://llmquantdata.com) 的 MCP server。通过 [Model Context Protocol](https://modelcontextprotocol.io) 把金融数据（百科、论文、行情、宏观指标、SEC 财报等）接入任何 AI agent。

配置一次，所有 agent 环境直接可用。

<p align="center">
  <img src="./assets/agent-harness.png" alt="覆盖主流 agent 环境" width="720" />
</p>

> [!TIP]
> 我们还在做 **llmquantdata-skills** — 把这些数据工具串成现成的金融工作流（个股研究、宏观分析等），开箱即用。

## 可用工具

> [!NOTE]
> Credit 计费目前处于 **beta**，下表额度可能调整。在 [llmquantdata.com](https://llmquantdata.com) 注册即送免费 credits，不用绑卡。

| 工具 | 说明 | Credit |
|------|------|--------|
| `wiki_search` | 语义搜索 50,000+ 量化百科词条 | 1 |
| `wiki_read` | 按 ID 读取百科词条 | 0 |
| `paper_search` | 语义搜索 1,200+ 研究论文 | 1 |
| `paper_read` | 按章节读取论文（摘要、方法、结论等） | 0 |
| `crypto_historical_klines` | 加密货币历史 K 线（Binance 现货） | 1 |
| `crypto_snapshot` | 加密货币实时价格 + 24h 统计 | 1 |
| `equity_historical_prices` | 美股日线 OHLCV + 分红/拆股 | 1 |
| `macro_indicator_search` | 浏览 50+ 精选宏观指标（FRED 等） | 0 |
| `macro_indicator_history` | 查询宏观指标历史数据 | 1 |
| `macro_indicator_snapshot` | 获取宏观指标最新值 | 1 |
| `sec_filing_browse` | 浏览 SEC 10-K / 10-Q 财报元数据 | 0 |
| `sec_filing_read` | 读取 SEC 财报章节正文 | 1 |
| `sec_13f_list_manager_holdings` | 列出某机构最新季度 13F 持仓（覆盖 Top 1000 × 最近 4 季度） | 1 |
| `sec_13f_list_ticker_holders` | 列出持有某 ticker 的机构（覆盖 Top 1000 × 最近 4 季度） | 1 |

> 更多数据（新闻、公司基本面、earnings call 等）见[路线图](#路线图)。

每种数据支持四种查询方式：

<p align="center">
  <img src="./assets/data-access.png" alt="四种查询方式 — 原始数据、语义搜索、PageIndex 树、知识图谱" width="720" />
</p>

## 试一试

用 [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) 在浏览器里交互测试：

```bash
export LLMQUANT_API_KEY=your_api_key
npx @modelcontextprotocol/inspector npx -y @llmquant/data-mcp
```

> [!NOTE]
> 想持久化 key，把 `export LLMQUANT_API_KEY=your_api_key` 加到 `~/.zshrc` 或 `~/.bashrc`。

<p align="center">
  <img src="./assets/mcp-inspector.png" alt="MCP Inspector" width="720" />
</p>

> [!TIP]
> 需要 API key — 在 [llmquantdata.com](https://llmquantdata.com) 免费注册。

## 接入方式

### Claude Code

```bash
claude mcp add llmquant-data \
  -e LLMQUANT_API_KEY=your_api_key \
  -- npx -y @llmquant/data-mcp
```

### Cursor

写入 `.cursor/mcp.json`（项目级）或 `~/.cursor/mcp.json`（全局）：

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

### 其他 MCP 客户端

支持 stdio 的客户端都能用这段配置：

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
> 更多客户端的接入指南在补充中。你用的框架没列出来？[提个 Issue](https://github.com/LLMQuant/data-mcp/issues)，我们来加。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `LLMQUANT_API_KEY` | 是 | — | API key |
| `LLMQUANT_BASE_URL` | 否 | `https://api.llmquantdata.com` | API 地址 |
| `LLMQUANT_API_TIMEOUT_MS` | 否 | `15000` | 请求超时，毫秒（最大 120000） |

## 路线图

- [ ] Streamable HTTP transport（不装 Node.js 也能远程用）
- [ ] 更多数据 — 新闻、公司基本面、earnings call
- [ ] Agent skills 配套包（**llmquantdata-skills**）
- [ ] 更多 agent 框架接入指南

有想法？[提 Issue](https://github.com/LLMQuant/data-mcp/issues) 或邮件 **contact@llmquant.com**。

## 贡献

本仓库是**只读镜像**，不接受 PR。

发现问题或有建议？直接 [开 Issue](https://github.com/LLMQuant/data-mcp/issues)。

## License

[MIT](./LICENSE)
