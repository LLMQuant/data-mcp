import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import type { McpToolRegistry } from "./registry";

import { registerNewsBrowseTool } from "./news-browse";

interface HarnessTool {
  execute: (input: unknown) => Promise<string>;
  parameters: z.ZodTypeAny;
}

function createToolHarness() {
  const tools = new Map<string, HarnessTool>();
  return {
    server: {
      addTool(tool: {
        name: string;
        parameters: z.ZodTypeAny;
        execute: (input: unknown) => Promise<string>;
      }) {
        tools.set(tool.name, {
          execute: tool.execute,
          parameters: tool.parameters,
        });
      },
    } as McpToolRegistry,
    get(name: string) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Missing tool: ${name}`);
      return tool;
    },
  };
}

function sampleResponse() {
  return {
    data: {
      items: [
        {
          title: "NVIDIA Announces Q1 Results",
          abstract: "Quarterly revenue reached a record.",
          summary: "NVIDIA reported record quarterly revenue.",
          events: ["earnings", "guidance"],
          topics: ["artificial_intelligence", "semiconductors"],
          tickers: ["NVDA"],
          published_at: "2026-06-01",
          source_url: "https://www.sec.gov/Archives/test",
        },
      ],
      count: 1,
    },
    meta: {
      creditsUsed: 1,
      remainingCredits: 99,
      notice: "More matching news is available; narrow the date range.",
    },
  };
}

test("news_browse forwards the Web data/meta contract without legacy aliases", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async getNewsBrowse(params: unknown) {
      calls.push(params);
      return sampleResponse();
    },
  };

  registerNewsBrowseTool(harness.server, api as never);
  const tool = harness.get("news_browse");
  const input = tool.parameters.parse({
    tickers: ["NVDA"],
    events: ["earnings"],
    topics: ["artificial_intelligence"],
  });
  const payload = JSON.parse(await tool.execute(input)) as {
    summary: string;
    data: ReturnType<typeof sampleResponse>["data"];
    meta: ReturnType<typeof sampleResponse>["meta"];
  };

  assert.match(payload.summary, /NVDA: 1 recent news item/);
  assert.deepEqual(payload.data, sampleResponse().data);
  assert.deepEqual(payload.meta, sampleResponse().meta);
  assert.equal("items" in payload, false);
  assert.equal("item" in payload, false);
  assert.deepEqual(Object.keys(payload.data.items[0]!).sort(), [
    "abstract",
    "events",
    "published_at",
    "source_url",
    "summary",
    "tickers",
    "title",
    "topics",
  ]);
  assert.deepEqual(calls[0], {
    tickers: ["NVDA"],
    events: ["earnings"],
    topics: ["artificial_intelligence"],
    startDate: undefined,
    endDate: undefined,
    limit: 10,
  });
});

test("news_browse allows a zero-filter market query and defaults limit", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const parsed = harness.get("news_browse").parameters.parse({}) as {
    limit: number;
  };
  assert.equal(parsed.limit, 10);
});

test("news_browse enforces ticker count and controlled event/topic enums", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);
  const schema = harness.get("news_browse").parameters;

  assert.equal(
    schema.safeParse({ tickers: ["A", "B", "C", "D", "E", "F"] }).success,
    false,
  );
  assert.equal(schema.safeParse({ events: ["earnings", "other"] }).success, true);
  assert.equal(schema.safeParse({ events: ["market_rally"] }).success, false);
  assert.equal(
    schema.safeParse({ topics: ["artificial_intelligence"] }).success,
    true,
  );
  assert.equal(schema.safeParse({ topics: ["ai"] }).success, false);
});

test("news_browse enforces paired valid ordered dates", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);
  const schema = harness.get("news_browse").parameters;

  assert.equal(schema.safeParse({ start_date: "2026-06-01" }).success, false);
  assert.equal(
    schema.safeParse({
      start_date: "2026-02-29",
      end_date: "2026-03-01",
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      start_date: "2026-06-09",
      end_date: "2026-06-01",
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      start_date: "2026-06-01",
      end_date: "2026-06-09",
      limit: 25,
    }).success,
    true,
  );
});

test("news_browse enforces limit 1..25", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);
  const schema = harness.get("news_browse").parameters;

  assert.equal(schema.safeParse({ limit: 0 }).success, false);
  assert.equal(schema.safeParse({ limit: 26 }).success, false);
  assert.equal(schema.safeParse({ limit: 25 }).success, true);
});
