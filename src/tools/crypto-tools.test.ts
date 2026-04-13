import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

import { registerCryptoHistoricalTool } from "./crypto-historical";
import { registerCryptoSnapshotTool } from "./crypto-snapshot";

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

test("crypto_historical_klines formats candle data and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getCryptoHistorical() {
      return {
        data: {
          ticker: "BTC-USD",
          interval: "1d",
          prices: [
            {
              open: 87000.5,
              high: 87500.0,
              low: 86800.0,
              close: 87200.0,
              volume: 1234.56,
              time: "2026-03-28T00:00:00Z",
            },
            {
              open: 87200.0,
              high: 88000.0,
              low: 87100.0,
              close: 87800.0,
              volume: 1500.0,
              time: "2026-03-29T00:00:00Z",
            },
          ],
        },
        meta: {
          count: 2,
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerCryptoHistoricalTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("crypto_historical_klines").execute({
      ticker: "BTC-USD",
      interval: "1d",
      limit: 2,
    }),
  ) as {
    summary: string;
    item: { ticker: string; interval: string; prices: Array<{ close: number }> };
    meta: { count: number; creditsUsed: number };
  };

  assert.match(payload.summary, /BTC-USD 1d klines: 2 candle/);
  assert.equal(payload.item.ticker, "BTC-USD");
  assert.equal(payload.item.interval, "1d");
  assert.equal(payload.item.prices.length, 2);
  assert.equal(payload.item.prices[0]?.close, 87200.0);
  assert.equal(payload.meta.count, 2);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("crypto_historical_klines handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getCryptoHistorical() {
      return {
        data: { ticker: "XYZ-USD", interval: "1h", prices: [] },
        meta: { count: 0, creditsUsed: 1, remainingCredits: 98 },
      };
    },
  };

  registerCryptoHistoricalTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("crypto_historical_klines").execute({
      ticker: "XYZ-USD",
      interval: "1h",
    }),
  ) as { summary: string; item: { prices: unknown[] } };

  assert.match(payload.summary, /No kline data found for XYZ-USD/);
  assert.equal(payload.item.prices.length, 0);
});

test("crypto_snapshot formats price summary with change percentage", async () => {
  const harness = createToolHarness();
  const api = {
    async getCryptoSnapshot() {
      return {
        data: {
          price: 87500.25,
          ticker: "BTC-USD",
          dayChange: 1200.5,
          dayChangePercent: 1.39,
          volume24h: 28500.75,
          time: "2026-03-30T12:00:00Z",
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 97,
        },
      };
    },
  };

  registerCryptoSnapshotTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("crypto_snapshot").execute({ ticker: "BTC-USD" }),
  ) as {
    summary: string;
    item: { price: number; ticker: string; dayChangePercent: number; volume24h: number };
    meta: { creditsUsed: number };
  };

  assert.match(payload.summary, /BTC-USD/);
  assert.match(payload.summary, /\+1\.39%/);
  assert.equal(payload.item.price, 87500.25);
  assert.equal(payload.item.ticker, "BTC-USD");
  assert.equal(payload.item.dayChangePercent, 1.39);
  assert.equal(payload.item.volume24h, 28500.75);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("crypto_snapshot formats negative change correctly", async () => {
  const harness = createToolHarness();
  const api = {
    async getCryptoSnapshot() {
      return {
        data: {
          price: 2100.0,
          ticker: "ETH-USD",
          dayChange: -85.5,
          dayChangePercent: -3.91,
          volume24h: 15000.0,
          time: "2026-03-30T12:00:00Z",
        },
        meta: { creditsUsed: 1, remainingCredits: 96 },
      };
    },
  };

  registerCryptoSnapshotTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("crypto_snapshot").execute({ ticker: "ETH-USD" }),
  ) as { summary: string };

  assert.match(payload.summary, /ETH-USD/);
  assert.match(payload.summary, /-3\.91%/);
});
