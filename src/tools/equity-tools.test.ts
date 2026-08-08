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

test("equity_historical_prices forwards limit and take_from with date boundaries", async () => {
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
    take_from: "earliest",
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.ticker, "AAPL");
  assert.equal(captured[0]?.startDate, "2020-01-01");
  assert.equal(captured[0]?.endDate, "2020-12-31");
  assert.equal(captured[0]?.limit, 5);
  assert.equal(captured[0]?.takeFrom, "earliest");
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
  assert.equal(captured[0]?.takeFrom, "latest");
  assert.equal(captured[0]?.startDate, undefined);
  assert.equal(captured[0]?.endDate, undefined);
});

test("equity_historical_prices accepts a single start_date and guards earliest without start", async () => {
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
    limit: 3,
  });
  assert.equal(captured[0]?.startDate, "2020-01-01");
  assert.equal(captured[0]?.endDate, undefined);

  await assert.rejects(
    () =>
      harness.get("equity_historical_prices").execute({
        ticker: "AAPL",
        end_date: "2020-12-31",
        take_from: "earliest",
      }),
    /requires start_date/,
  );
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

test("equity_intraday_prices forwards range with limit and take_from", async () => {
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
    limit: 35,
    take_from: "earliest",
  });

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.startDate, "2026-06-08");
  assert.equal(captured[0]?.endDate, "2026-06-18");
  assert.equal(captured[0]?.limit, 35);
  assert.equal(captured[0]?.takeFrom, "earliest");
});

test("equity_intraday_prices accepts single boundaries and rejects earliest without start_date", async () => {
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
        end_date: "2026-06-18",
        take_from: "earliest",
      }),
    /requires start_date/,
  );
  assert.equal(captured.length, 0);

  await harness.get("equity_intraday_prices").execute({
    ticker: "AAPL",
    end_date: "2026-06-18",
    limit: 35,
  });
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.endDate, "2026-06-18");
});

test("equity_intraday_prices rejects unsupported intervals and reversed ranges", async () => {
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
        start_date: "2026-06-15",
        end_date: "2026-06-01",
      }),
    /start_date must not be after end_date/,
  );
});

test("equity_intraday_prices rejects ranges longer than 14 calendar days before Web call", async () => {
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
      start_date: "2026-06-01",
      end_date: "2026-06-15",
    }).success,
    false,
  );
  await assert.rejects(
    () =>
      tool.execute({
        ticker: "AAPL",
        start_date: "2026-06-01",
        end_date: "2026-06-15",
      }),
    /14 calendar days/,
  );
  // §2.7: the message must point at an actionable next step.
  await assert.rejects(
    () =>
      tool.execute({
        ticker: "AAPL",
        start_date: "2026-06-01",
        end_date: "2026-06-15",
      }),
    /equity_historical_prices/,
  );
});

test("equity_intraday_prices accepts a window that is exactly 14 calendar days", async () => {
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
  const tool = harness.get("equity_intraday_prices");
  const exactlyFourteen = { ticker: "AAPL", start_date: "2026-06-01", end_date: "2026-06-14" };

  assert.equal(tool.parameters.safeParse(exactlyFourteen).success, true);
  await tool.execute(exactlyFourteen);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.startDate, "2026-06-01");
  assert.equal(captured[0]?.endDate, "2026-06-14");
});

test("equity_intraday_prices rejects an over-wide window when only start_date is given", async () => {
  const harness = createToolHarness();
  const api = {
    async getEquityIntraday() {
      throw new Error("should not call Web API");
    },
  };

  registerEquityIntradayTool(harness.server, api as never);
  const tool = harness.get("equity_intraday_prices");
  // end_date defaults to the current Eastern date, so a decade-old start_date
  // is an over-wide effective window no matter when this test runs.
  const openEnded = { ticker: "AAPL", start_date: "2015-01-01" };

  assert.equal(tool.parameters.safeParse(openEnded).success, false);
  await assert.rejects(() => tool.execute(openEnded), /14 calendar days/);
  await assert.rejects(
    () => tool.execute({ ...openEnded, take_from: "earliest" }),
    /14 calendar days/,
  );
});

test("equity_intraday_prices accepts a recent start_date-only window", async () => {
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
  const tool = harness.get("equity_intraday_prices");
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const recent = { ticker: "AAPL", start_date: threeDaysAgo };

  assert.equal(tool.parameters.safeParse(recent).success, true);
  await tool.execute(recent);
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.startDate, threeDaysAgo);
  assert.equal(captured[0]?.endDate, undefined);
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
