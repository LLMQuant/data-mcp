import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

import { registerEtfHoldingsTool } from "./etf-holdings";
import { registerEtfLookupTool } from "./etf-lookup";

function createToolHarness() {
  const tools = new Map<string, { execute: (input: unknown) => Promise<string> }>();

  return {
    server: {
      addTool(tool: { name: string; execute: (input: unknown) => Promise<string> }) {
        tools.set(tool.name, tool);
      },
    } as unknown as FastMCP,
    get(name: string) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }
      return tool;
    },
  };
}

const FULL_LOOKUP = {
  data: {
    ticker: "VTI",
    fund_name: "Vanguard Total Stock Market ETF",
    issuer: "vanguard",
    asset_class: "equity",
    category: "Broad U.S. Equity",
    cik: "0000036405",
    series_id: "S000002848",
    class_id: "C000007808",
    expense_ratio: null,
    aum: 826993958998.44,
    nav: null,
    market_price: null,
    premium_discount_pct: null,
    inception_date: null,
    holdings_count: 4000,
    top_holdings: [
      {
        holding_name: "Apple Inc",
        ticker: "AAPL",
        cusip: "037833100",
        isin: null,
        sector: null,
        country: "US",
        asset_type: "equity",
        weight: 0.065,
        market_value: 100,
      },
    ],
    sector_exposure: null,
    country_exposure: null,
    asset_type_exposure: null,
    source: "sec_nport",
    source_url: "https://www.sec.gov/...",
    as_of_date: "2026-03-31",
    fetched_at: "2026-05-13T00:00:00Z",
    stale: false,
    coverage_status: "full" as const,
    coverage_notice: "VTI ...",
  },
  meta: {
    creditsUsed: 0,
    remainingCredits: 7,
  },
};

const UNSUPPORTED_LOOKUP = {
  data: {
    ticker: "IBIT",
    fund_name: "iShares Bitcoin Trust ETF",
    issuer: "blackrock_ishares",
    asset_class: "crypto",
    category: "Crypto",
    cik: null,
    series_id: null,
    class_id: null,
    expense_ratio: null,
    aum: null,
    nav: null,
    market_price: null,
    premium_discount_pct: null,
    inception_date: null,
    holdings_count: null,
    top_holdings: [],
    sector_exposure: null,
    country_exposure: null,
    asset_type_exposure: null,
    source: null,
    source_url: null,
    as_of_date: null,
    fetched_at: null,
    stale: false,
    coverage_status: "unsupported" as const,
    coverage_notice: "IBIT is not safely mapped through SEC Series/Class data.",
  },
  meta: {
    creditsUsed: 0,
    remainingCredits: 7,
  },
};

const FULL_HOLDINGS = {
  data: {
    ticker: "VTI",
    fund_name: "Vanguard Total Stock Market ETF",
    issuer: "vanguard",
    holdings: [
      {
        holding_name: "Apple Inc",
        ticker: "AAPL",
        cusip: "037833100",
        isin: null,
        sedol: null,
        asset_type: "equity",
        sector: null,
        country: "US",
        shares: 1000,
        market_value: 300000,
        weight: 0.065,
        notional_value: null,
        source: "sec_nport",
        source_url: "https://www.sec.gov/...",
        as_of_date: "2026-03-31",
      },
    ],
    source: "sec_nport",
    source_url: "https://www.sec.gov/...",
    as_of_date: "2026-03-31",
    fetched_at: "2026-05-13T00:00:00Z",
    stale: false,
    coverage_status: "full" as const,
    coverage_notice: "VTI ...",
  },
  meta: {
    count: 1,
    limit: 50,
    creditsUsed: 1,
    remainingCredits: 6,
  },
};

test("etf_lookup forwards the ticker and passes data/meta through unchanged", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getEtfLookup(args: Record<string, unknown>) {
      captured.args = args;
      return FULL_LOOKUP;
    },
  } as never;

  registerEtfLookupTool(harness.server, api);
  const tool = harness.get("etf_lookup");
  const raw = await tool.execute({ ticker: "vti" });
  const parsed = JSON.parse(raw) as {
    summary: string;
    item: typeof FULL_LOOKUP.data;
    meta: typeof FULL_LOOKUP.meta;
  };

  assert.deepEqual(captured.args, { ticker: "vti" });
  assert.equal(parsed.item.ticker, "VTI");
  assert.equal(parsed.item.coverage_status, "full");
  assert.equal(parsed.meta.creditsUsed, 0);
  assert.match(parsed.summary, /VTI/);
  assert.match(parsed.summary, /full/);
});

test("etf_lookup surfaces a clear summary on coverage_status=unsupported", async () => {
  const harness = createToolHarness();
  const api = {
    async getEtfLookup() {
      return UNSUPPORTED_LOOKUP;
    },
  } as never;
  registerEtfLookupTool(harness.server, api);
  const raw = await harness.get("etf_lookup").execute({ ticker: "IBIT" });
  const parsed = JSON.parse(raw) as { summary: string; item: typeof UNSUPPORTED_LOOKUP.data };
  assert.match(parsed.summary, /not supported/i);
  assert.equal(parsed.item.coverage_status, "unsupported");
  assert.match(parsed.item.coverage_notice, /Series\/Class/);
});

test("etf_lookup propagates Web API errors as MCP errors", async () => {
  const harness = createToolHarness();
  const api = {
    async getEtfLookup() {
      throw new Error("boom");
    },
  } as never;
  registerEtfLookupTool(harness.server, api);
  await assert.rejects(
    () => harness.get("etf_lookup").execute({ ticker: "VTI" }),
    /boom/,
  );
});

test("etf_holdings forwards ticker + limit and passes data/meta through", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getEtfHoldings(args: Record<string, unknown>) {
      captured.args = args;
      return FULL_HOLDINGS;
    },
  } as never;
  registerEtfHoldingsTool(harness.server, api);
  const tool = harness.get("etf_holdings");
  const raw = await tool.execute({ ticker: "vti", limit: 25 });
  const parsed = JSON.parse(raw) as {
    summary: string;
    item: typeof FULL_HOLDINGS.data;
    meta: typeof FULL_HOLDINGS.meta;
  };
  assert.deepEqual(captured.args, { ticker: "vti", limit: 25 });
  assert.equal(parsed.item.ticker, "VTI");
  assert.equal(parsed.item.holdings.length, 1);
  assert.equal(parsed.item.holdings[0].cusip, "037833100");
  assert.equal(parsed.meta.creditsUsed, 1);
});

test("etf_holdings unsupported path surfaces coverage_status and zero credits", async () => {
  const harness = createToolHarness();
  const unsupported = {
    data: {
      ticker: "DRAM",
      fund_name: null,
      issuer: null,
      holdings: [],
      source: null,
      source_url: null,
      as_of_date: null,
      fetched_at: null,
      stale: false,
      coverage_status: "unsupported" as const,
      coverage_notice: "DRAM is not in the seed allowlist.",
    },
    meta: { count: 0, limit: 50, creditsUsed: 0, remainingCredits: 7 },
  };
  const api = {
    async getEtfHoldings() {
      return unsupported;
    },
  } as never;
  registerEtfHoldingsTool(harness.server, api);
  const raw = await harness.get("etf_holdings").execute({ ticker: "DRAM" });
  const parsed = JSON.parse(raw) as {
    summary: string;
    item: typeof unsupported.data;
    meta: typeof unsupported.meta;
  };
  assert.match(parsed.summary, /not supported/i);
  assert.equal(parsed.item.coverage_status, "unsupported");
  assert.deepEqual(parsed.item.holdings, []);
  assert.equal(parsed.meta.creditsUsed, 0);
});
