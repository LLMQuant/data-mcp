import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

import { registerEquityHistoricalTool } from "./equity-historical";

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
          count: 2,
          creditsUsed: 1,
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
    item: {
      ticker: string;
      interval: string;
      prices: Array<{ adjustedClose: number; dividend: number; stockSplit: number }>;
    };
    meta: { count: number; creditsUsed: number };
  };

  assert.match(payload.summary, /AAPL daily prices: 2 trading day/);
  assert.equal(payload.item.ticker, "AAPL");
  assert.equal(payload.item.interval, "1d");
  assert.equal(payload.item.prices.length, 2);
  assert.equal(payload.item.prices[0]?.adjustedClose, 211.55);
  assert.equal(payload.item.prices[0]?.dividend, 0.24);
  assert.equal(payload.item.prices[1]?.stockSplit, 1);
  assert.equal(payload.meta.count, 2);
  assert.equal(payload.meta.creditsUsed, 1);
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
          count: 0,
          creditsUsed: 1,
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
  ) as { summary: string; item: { prices: unknown[] } };

  assert.match(payload.summary, /No price data found for AAPL/);
  assert.equal(payload.item.prices.length, 0);
});
