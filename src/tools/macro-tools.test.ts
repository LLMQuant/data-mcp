import assert from "node:assert/strict";
import test from "node:test";
import type { McpToolRegistry } from "./registry";

import { registerMacroIndicatorHistoryTool } from "./macro-indicator-history";
import { registerMacroIndicatorSearchTool } from "./macro-indicator-search";
import { registerMacroIndicatorSnapshotTool } from "./macro-indicator-snapshot";

type HarnessTool = {
  name: string;
  description?: string;
  execute: (input: unknown) => Promise<string>;
};

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

test("macro tool public descriptions avoid internal coverage terms", () => {
  const harness = createToolHarness();
  const api = {};

  registerMacroIndicatorSearchTool(harness.server, api as never);
  registerMacroIndicatorHistoryTool(harness.server, api as never);
  registerMacroIndicatorSnapshotTool(harness.server, api as never);

  for (const name of [
    "macro_indicator_search",
    "macro_indicator_history",
    "macro_indicator_snapshot",
  ]) {
    assert.doesNotMatch(
      harness.get(name).description ?? "",
      /\b(allowlist|seed|adapter)\b/i,
    );
  }
});

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
    data: {
      seriesId: string;
      title: string;
      frequency: string;
      units: string;
      observations: Array<{
        value: number | null;
        realtimeStart: string;
        realtimeEnd: string;
      }>;
      attribution: string;
    };
    meta: {
      creditsUsed: number;
      remainingCredits: number;
    };
  };

  assert.match(payload.summary, /us\.cpi\.headline \(Monthly\): 2 observation/);
  assert.equal(payload.data.seriesId, "CPIAUCSL");
  assert.equal(payload.data.frequency, "Monthly");
  assert.equal(payload.data.units, "Index 1982-1984=100");
  assert.equal(payload.data.title, "Consumer Price Index for All Urban Consumers: All Items");
  assert.equal(payload.data.attribution, "FRED");
  assert.equal(payload.data.observations.length, 2);
  assert.equal(payload.data.observations[1]?.value, 322.18);
  assert.equal(payload.data.observations[0]?.realtimeStart, "2026-03-12");
  assert.equal(payload.data.observations[0]?.realtimeEnd, "2026-03-12");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 31);
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
  ) as { summary: string; data: { observations: unknown[] } };

  assert.match(payload.summary, /No observations found for us\.money_supply\.m2/);
  assert.equal(payload.data.observations.length, 0);
});

test("macro_indicator_history surfaces stale flag when data refresh failed", async () => {
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
              date: "2026-03-01",
              value: 322.18,
              realtimeStart: "2026-04-10",
              realtimeEnd: "2026-04-10",
            },
          ],
          attribution: "FRED",
          stale: true,
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 27,
        },
      };
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_history").execute({
      indicator: "us.cpi.headline",
      limit: 1,
    }),
  ) as {
    data: { observations: unknown[]; stale?: boolean };
    meta: { remainingCredits: number };
  };

  assert.equal(payload.data.stale, true);
  assert.equal(payload.meta.remainingCredits, 27);
  assert.equal(payload.data.observations.length, 1);
});

test("macro_indicator_history forwards limit when range is not set", async () => {
  const harness = createToolHarness();
  const calls: Array<Record<string, unknown>> = [];
  const api = {
    async getMacroHistorical(args: Record<string, unknown>) {
      calls.push(args);
      return {
        data: {
          indicator: "us.cpi.headline",
          seriesId: "CPIAUCSL",
          title: "CPI",
          frequency: "Monthly",
          units: "Index",
          observations: [],
          attribution: "FRED",
        },
        meta: { creditsUsed: 1, remainingCredits: 99 },
      };
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  await harness.get("macro_indicator_history").execute({
    indicator: "us.cpi.headline",
    limit: 24,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.limit, 24);
  assert.equal(calls[0]!.takeFrom, "latest");
  assert.equal(calls[0]!.startDate, undefined);
  assert.equal(calls[0]!.endDate, undefined);
});

test("macro_indicator_history forwards limit and take_from with date boundaries", async () => {
  const harness = createToolHarness();
  const calls: Array<Record<string, unknown>> = [];
  const api = {
    async getMacroHistorical(args: Record<string, unknown>) {
      calls.push(args);
      return {
        data: {
          indicator: "us.gdp.real",
          seriesId: "GDPC1",
          title: "Real GDP",
          frequency: "Quarterly",
          units: "Billions of Chained 2017 Dollars",
          observations: [],
          attribution: "FRED",
        },
        meta: { creditsUsed: 1, remainingCredits: 50 },
      };
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  await harness.get("macro_indicator_history").execute({
    indicator: "us.gdp.real",
    start_date: "2010-01-01",
    end_date: "2024-01-01",
    limit: 30,
    take_from: "earliest",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.limit, 30);
  assert.equal(calls[0]!.takeFrom, "earliest");
  assert.equal(calls[0]!.startDate, "2010-01-01");
  assert.equal(calls[0]!.endDate, "2024-01-01");
});

test("macro_indicator_history guards earliest without start_date and reversed ranges", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroHistorical() {
      throw new Error("should not call Web API");
    },
  };

  registerMacroIndicatorHistoryTool(harness.server, api as never);
  await assert.rejects(
    () =>
      harness.get("macro_indicator_history").execute({
        indicator: "us.gdp.real",
        end_date: "2024-01-01",
        take_from: "earliest",
      }),
    /requires start_date/,
  );
  await assert.rejects(
    () =>
      harness.get("macro_indicator_history").execute({
        indicator: "us.gdp.real",
        start_date: "2024-01-01",
        end_date: "2010-01-01",
      }),
    /start_date must not be after end_date/,
  );
});

test("macro_indicator_search formats catalog results and preserves metadata", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async getMacroIndicators(params: unknown) {
      calls.push(params);
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
        // Macro catalog is a FREE endpoint (credit.md §三 → 0 credits). Meta is
        // the compliant success envelope `{ creditsUsed: 0, remainingCredits,
        // notice? }`; `count` lives in `data`, no FRED `sourceNotice` here.
        meta: {
          creditsUsed: 0,
          remainingCredits: 31,
        },
      };
    },
  };

  registerMacroIndicatorSearchTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_search").execute({
      category: "Labor",
      query: "jobs",
      limit: 2,
    }),
  ) as {
    summary: string;
    data: Array<{ indicator: string; seriesId: string; category: string }>;
    meta: { creditsUsed: number; remainingCredits: number };
  };

  assert.match(payload.summary, /Found 2 macro indicator/);
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0]?.indicator, "us.unemployment_rate");
  assert.equal(payload.data[1]?.seriesId, "PAYEMS");
  assert.equal(payload.data[0]?.category, "Labor");
  assert.equal(payload.meta.creditsUsed, 0);
  assert.equal(payload.meta.remainingCredits, 31);
  assert.deepEqual(calls[0], {
    query: "jobs",
    category: "Labor",
    frequency: undefined,
    limit: 2,
  });
});

test("macro_indicator_search handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getMacroIndicators() {
      return {
        data: [],
        meta: {
          creditsUsed: 0,
          remainingCredits: 31,
        },
      };
    },
  };

  registerMacroIndicatorSearchTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_search").execute({
      query: "nonexistent indicator",
    }),
  ) as { summary: string; data: unknown[] };

  assert.match(payload.summary, /No matching indicators found/);
  assert.equal(payload.data.length, 0);
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
          creditsUsed: 0,
          remainingCredits: 29,
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
    data: {
      latest: {
        value: number | null;
        realtimeStart: string;
        realtimeEnd: string;
      } | null;
      deltaPct: number | null;
    };
    meta: {
      creditsUsed: number;
      remainingCredits: number;
    };
  };

  assert.match(payload.summary, /us\.rates\.fed_funds latest: 4\.5, delta \+5\.88%/);
  assert.equal(payload.data.latest?.value, 4.5);
  assert.equal(payload.data.latest?.realtimeStart, "2026-04-10");
  assert.equal(payload.data.latest?.realtimeEnd, "2026-04-10");
  assert.equal(payload.data.deltaPct, 5.88);
  assert.equal(payload.meta.creditsUsed, 0);
  assert.equal(payload.meta.remainingCredits, 29);
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
          creditsUsed: 0,
          remainingCredits: 28,
        },
      };
    },
  };

  registerMacroIndicatorSnapshotTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("macro_indicator_snapshot").execute({
      indicator: "us.gdp.real",
    }),
  ) as { summary: string; data: { latest: null } };

  assert.match(payload.summary, /No observations available for us\.gdp\.real/);
  assert.equal(payload.data.latest, null);
});
