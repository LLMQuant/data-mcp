import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

import { registerMacroIndicatorHistoryTool } from "./macro-indicator-history";
import { registerMacroIndicatorSearchTool } from "./macro-indicator-search";
import { registerMacroIndicatorSnapshotTool } from "./macro-indicator-snapshot";

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

test("macro_indicator_history formats observations and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroHistorical() {
      return {
        data: {
          indicator: "us.cpi.headline",
          seriesId: "CPIAUCSL",
          title: "Consumer Price Index for All Urban Consumers: All Items",
          frequency: "Monthly",
          units: "Index 1982-1984=100",
          observations: [
            {
              date: "2026-02-01",
              value: 321.45,
              realtimeStart: "2026-03-12",
              realtimeEnd: "2026-03-12",
            },
            {
              date: "2026-03-01",
              value: 322.18,
              realtimeStart: "2026-04-10",
              realtimeEnd: "2026-04-10",
            },
          ],
          attribution: "FRED",
        },
        meta: {
          count: 2,
          creditsUsed: 1,
          remainingCredits: 31,
        },
      };
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_history").execute({
      indicator: "us.cpi.headline",
      limit: 2,
    }),
  ) as {
    summary: string;
    item: { seriesId: string; frequency: string; observations: Array<{ value: number | null }> };
    meta: { count: number; creditsUsed: number };
  };

  assert.match(payload.summary, /us\.cpi\.headline \(Monthly\): 2 observation/);
  assert.equal(payload.item.seriesId, "CPIAUCSL");
  assert.equal(payload.item.frequency, "Monthly (Index 1982-1984=100)");
  assert.equal(payload.item.observations.length, 2);
  assert.equal(payload.item.observations[1]?.value, 322.18);
  assert.equal(payload.meta.count, 2);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("macro_indicator_history handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroHistorical() {
      return {
        data: {
          indicator: "us.money_supply.m2",
          seriesId: "M2SL",
          title: "M2",
          frequency: "Weekly",
          units: "Billions of Dollars",
          observations: [],
          attribution: "FRED",
        },
        meta: {
          count: 0,
          creditsUsed: 1,
          remainingCredits: 30,
        },
      };
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_history").execute({
      indicator: "us.money_supply.m2",
      limit: 5,
    }),
  ) as { summary: string; item: { observations: unknown[] } };

  assert.match(payload.summary, /No observations found for us\.money_supply\.m2/);
  assert.equal(payload.item.observations.length, 0);
});

test("macro_indicator_search formats catalog results and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroIndicators() {
      return {
        data: [
          {
            indicator: "us.unemployment_rate",
            seriesId: "UNRATE",
            title: "Unemployment Rate",
            category: "Labor",
            frequency: "Monthly",
            units: "Percent",
            observationStart: "1948-01-01",
            observationEnd: "2026-03-01",
            copyrightStatus: "public",
            attribution: "FRED",
          },
          {
            indicator: "us.nonfarm_payrolls",
            seriesId: "PAYEMS",
            title: "All Employees, Total Nonfarm",
            category: "Labor",
            frequency: "Monthly",
            units: "Thousands of Persons",
            observationStart: "1939-01-01",
            observationEnd: "2026-03-01",
            copyrightStatus: "public",
            attribution: "FRED",
          },
        ],
        meta: {
          count: 2,
          creditsUsed: 1,
        },
      };
    },
  };

  registerMacroIndicatorSearchTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_search").execute({
      category: "Labor",
      limit: 2,
    }),
  ) as {
    summary: string;
    items: Array<{ indicator: string; seriesId: string; category: string }>;
    meta: { count: number; creditsUsed: number };
  };

  assert.match(payload.summary, /Found 2 macro indicator/);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0]?.indicator, "us.unemployment_rate");
  assert.equal(payload.items[1]?.seriesId, "PAYEMS");
  assert.equal(payload.items[0]?.category, "Labor");
  assert.equal(payload.meta.count, 2);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("macro_indicator_search handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroIndicators() {
      return {
        data: [],
        meta: {
          count: 0,
          creditsUsed: 1,
        },
      };
    },
  };

  registerMacroIndicatorSearchTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_search").execute({
      q: "nonexistent indicator",
    }),
  ) as { summary: string; items: unknown[] };

  assert.match(payload.summary, /No matching indicators found/);
  assert.equal(payload.items.length, 0);
});

test("macro_indicator_snapshot formats latest value and delta metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroSnapshot() {
      return {
        data: {
          indicator: "us.rates.fed_funds",
          seriesId: "FEDFUNDS",
          title: "Federal Funds Effective Rate",
          frequency: "Monthly",
          units: "Percent",
          latest: {
            date: "2026-03-01",
            value: 4.5,
            realtimeStart: "2026-04-10",
            realtimeEnd: "2026-04-10",
          },
          previous: {
            date: "2026-02-01",
            value: 4.25,
          },
          deltaAbs: 0.25,
          deltaPct: 5.88,
          attribution: "FRED",
        },
        meta: {
          creditsUsed: 1,
        },
      };
    },
  };

  registerMacroIndicatorSnapshotTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_snapshot").execute({
      indicator: "us.rates.fed_funds",
    }),
  ) as {
    summary: string;
    item: { latest: { value: number | null } | null; deltaPct: number | null };
    meta: { creditsUsed: number };
  };

  assert.match(payload.summary, /us\.rates\.fed_funds latest: 4\.5, delta \+5\.88%/);
  assert.equal(payload.item.latest?.value, 4.5);
  assert.equal(payload.item.deltaPct, 5.88);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("macro_indicator_snapshot handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroSnapshot() {
      return {
        data: {
          indicator: "us.gdp.real",
          seriesId: "GDPC1",
          title: "Real Gross Domestic Product",
          frequency: "Quarterly",
          units: "Billions of Chained 2017 Dollars",
          latest: null,
          previous: null,
          deltaAbs: null,
          deltaPct: null,
          attribution: "FRED",
        },
        meta: {
          creditsUsed: 1,
        },
      };
    },
  };

  registerMacroIndicatorSnapshotTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_snapshot").execute({
      indicator: "us.gdp.real",
    }),
  ) as { summary: string; item: { latest: null } };

  assert.match(payload.summary, /No observations available for us\.gdp\.real/);
  assert.equal(payload.item.latest, null);
});
