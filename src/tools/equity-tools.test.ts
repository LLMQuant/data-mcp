import assert from "node:assert/strict";
import test from "node:test";
import type { McpToolRegistry } from "./registry";

import { registerEquityHistoricalTool } from "./equity-historical";
import { registerEquityIntradayTool } from "./equity-intraday";

interface HarnessTool {
  name: string;
  execute: (input: unknown) => Promise<string>;
  parameters: { safeParse(input: unknown): { success: boolean } };
}

function createToolHarness() {
  const tools = new Map<string, HarnessTool>();

  return {
    server: {
      addTool(tool: HarnessTool) {
        tools.set(tool.name, tool);
      },
    } as McpToolRegistry,
    get(name: string) {
      const tool = tools.get(name);

      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }

      return tool;
    },
  };
}

test("equity_historical_prices formats daily bars and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getEquityHistorical() {
      return {
        data: {
          ticker: "AAPL",
          interval: "1d",
          prices: [
            {
              open: 210.12,
              high: 212.45,
              low: 209.8,
              close: 211.55,
              volume: 52345678,
              adjustedClose: 211.55,
              dividend: 0.24,
              stockSplit: 1,
              time: "2026-04-08",
            },
            {
              open: 211.9,
              high: 214.1,
              low: 211.2,
              close: 213.88,
              volume: 49876543,
              adjustedClose: 213.88,
              dividend: 0,
              stockSplit: 1,
              time: "2026-04-09",
            },
          ],
        },
        meta: {
          creditsUsed: 0,
          remainingCredits: 24,
        },
      };
    },
  };

  registerEquityHistoricalTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("equity_historical_prices").execute({
      ticker: "AAPL",
      start_date: "2026-04-08",
      end_date: "2026-04-09",
    }),
  ) as {
    summary: string;
    data: {
      ticker: string;
      interval: string;
      prices: Array<{ adjustedClose: number; dividend: number; stockSplit: number }>;
    };
    meta: { creditsUsed: number; remainingCredits: number };
  };

  assert.match(payload.summary, /AAPL daily prices: 2 trading day/);
  assert.equal(payload.data.ticker, "AAPL");
  assert.equal(payload.data.interval, "1d");
  assert.equal(payload.data.prices.length, 2);
  assert.equal(payload.data.prices[0]?.adjustedClose, 211.55);
  assert.equal(payload.data.prices[0]?.dividend, 0.24);
  assert.equal(payload.data.prices[1]?.stockSplit, 1);
  assert.equal(payload.meta.creditsUsed, 0);
  assert.equal(payload.meta.remainingCredits, 24);
});

test("equity_historical_prices strips limit when both start_date and end_date are provided", async () => {
  // Anti-pattern §六 #5 (Wrapper-only MCP coverage):
  // capture call args to the mocked web client and assert limit was actively
  // stripped at the MCP boundary, instead of silently relying on downstream
  // behavior. Schema description promises "ignored when start_date/end_date
  // are set"; this test proves the execute layer keeps that promise.
  // See contexts/mcp/design/tool-expansion.md §十一.
  const harness = createToolHarness();
  const captured: Array<Record<string, unknown>> = [];
  const api = {
    async getEquityHistorical(params: Record<string, unknown>) {
      captured.push(params);
      return {
        data: { ticker: "AAPL", interval: "1d", prices: [] },
        meta: { creditsUsed: 0, remainingCredits: 10 },
      };
    },
  };

  registerEquityHistoricalTool(harness.server, api as never);
  await harness.get("equity_historical_prices").execute({
    ticker: "AAPL",
    start_date: "2020-01-01",
    end_date: "2020-12-31",
    limit: 5,
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.ticker, "AAPL");
  assert.equal(captured[0]?.startDate, "2020-01-01");
  assert.equal(captured[0]?.endDate, "2020-12-31");
  assert.equal(captured[0]?.limit, undefined);
});

test("equity_historical_prices forwards limit when no range is provided", async () => {
  // Companion to the strip-on-range test: in recent mode the user-supplied
  // limit must reach the API client untouched.
  const harness = createToolHarness();
  const captured: Array<Record<string, unknown>> = [];
  const api = {
    async getEquityHistorical(params: Record<string, unknown>) {
      captured.push(params);
      return {
        data: { ticker: "AAPL", interval: "1d", prices: [] },
        meta: { creditsUsed: 0, remainingCredits: 10 },
      };
    },
  };

  registerEquityHistoricalTool(harness.server, api as never);
  await harness.get("equity_historical_prices").execute({
    ticker: "AAPL",
    limit: 7,
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.limit, 7);
  assert.equal(captured[0]?.startDate, undefined);
  assert.equal(captured[0]?.endDate, undefined);
});

test("equity_historical_prices handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getEquityHistorical() {
      return {
        data: {
          ticker: "AAPL",
          interval: "1d",
          prices: [],
        },
        meta: {
          creditsUsed: 0,
          remainingCredits: 23,
        },
      };
    },
  };

  registerEquityHistoricalTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("equity_historical_prices").execute({
      ticker: "AAPL",
      limit: 5,
    }),
  ) as { summary: string; data: { prices: unknown[] } };

  assert.match(payload.summary, /No price data found for AAPL/);
  assert.equal(payload.data.prices.length, 0);
});

test("equity_intraday_prices formats 1h bars and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getEquityIntraday() {
      return {
        data: {
          ticker: "AAPL",
          interval: "1h",
          prices: [
            {
              open: 195,
              high: 197,
              low: 194,
              close: 196,
              volume: 1234567,
              time: "2026-06-18T13:30:00Z",
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 24,
        },
      };
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("equity_intraday_prices").execute({
      ticker: "AAPL",
      limit: 35,
    }),
  ) as {
    summary: string;
    data: { ticker: string; interval: string; prices: Array<{ time: string }> };
    meta: { creditsUsed: number; remainingCredits: number };
  };

  assert.match(payload.summary, /AAPL 1h intraday prices: 1 bar/);
  assert.equal(payload.data.ticker, "AAPL");
  assert.equal(payload.data.interval, "1h");
  assert.equal(payload.data.prices[0]?.time, "2026-06-18T13:30:00Z");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 24);
});

test("equity_intraday_prices forwards limit in recent mode", async () => {
  const harness = createToolHarness();
  const captured: Array<Record<string, unknown>> = [];
  const api = {
    async getEquityIntraday(params: Record<string, unknown>) {
      captured.push(params);
      return {
        data: { ticker: "AAPL", interval: "1h", prices: [] },
        meta: { creditsUsed: 1, remainingCredits: 10 },
      };
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  await harness.get("equity_intraday_prices").execute({
    ticker: "AAPL",
    limit: 7,
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.ticker, "AAPL");
  assert.equal(captured[0]?.interval, "1h");
  assert.equal(captured[0]?.limit, 7);
  assert.equal(captured[0]?.startDate, undefined);
  assert.equal(captured[0]?.endDate, undefined);
});

test("equity_intraday_prices forwards range without limit", async () => {
  const harness = createToolHarness();
  const captured: Array<Record<string, unknown>> = [];
  const api = {
    async getEquityIntraday(params: Record<string, unknown>) {
      captured.push(params);
      return {
        data: { ticker: "AAPL", interval: "1h", prices: [] },
        meta: { creditsUsed: 1, remainingCredits: 10 },
      };
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  await harness.get("equity_intraday_prices").execute({
    ticker: "AAPL",
    start_date: "2026-06-08",
    end_date: "2026-06-18",
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.startDate, "2026-06-08");
  assert.equal(captured[0]?.endDate, "2026-06-18");
  assert.equal(captured[0]?.limit, undefined);
});

test("equity_intraday_prices rejects limit combined with range before Web call", async () => {
  const harness = createToolHarness();
  const captured: Array<Record<string, unknown>> = [];
  const api = {
    async getEquityIntraday(params: Record<string, unknown>) {
      captured.push(params);
      return {
        data: { ticker: "AAPL", interval: "1h", prices: [] },
        meta: { creditsUsed: 1, remainingCredits: 10 },
      };
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  await assert.rejects(
    () =>
      harness.get("equity_intraday_prices").execute({
        ticker: "AAPL",
        start_date: "2026-06-08",
        end_date: "2026-06-18",
        limit: 35,
      }),
    /limit cannot be combined/,
  );
  assert.equal(captured.length, 0);
});

test("equity_intraday_prices rejects unsupported intervals and long ranges", async () => {
  const harness = createToolHarness();
  const api = {
    async getEquityIntraday() {
      throw new Error("should not call Web API");
    },
  };

  registerEquityIntradayTool(harness.server, api as never);

  await assert.rejects(
    () =>
      harness.get("equity_intraday_prices").execute({
        ticker: "AAPL",
        interval: "30m",
      }),
    /1h/,
  );
  await assert.rejects(
    () =>
      harness.get("equity_intraday_prices").execute({
        ticker: "AAPL",
        start_date: "2026-06-01",
        end_date: "2026-06-15",
      }),
    /14 calendar days/,
  );
});

test("equity_intraday_prices schema rejects invalid range dates", () => {
  const harness = createToolHarness();
  const api = {
    async getEquityIntraday() {
      throw new Error("should not call Web API");
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  const tool = harness.get("equity_intraday_prices");

  assert.equal(
    tool.parameters.safeParse({
      ticker: "AAPL",
      start_date: "2026-02-30",
      end_date: "2026-03-01",
    }).success,
    false,
  );
  assert.equal(
    tool.parameters.safeParse({
      ticker: "AAPL",
      start_date: "20260601",
      end_date: "2026-06-02",
    }).success,
    false,
  );
});
