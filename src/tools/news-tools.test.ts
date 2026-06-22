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
        tools.set(tool.name, { execute: tool.execute, parameters: tool.parameters });
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

function sampleResponse() {
  return {
    data: {
      items: [
        {
          newsArticleId: "11111111-2222-4333-8444-555555555555",
          title: "NVIDIA Announces Q1 Results",
          source: {
            publisher: "NVIDIA Corp",
            sourceUrl: "https://www.sec.gov/Archives/test",
            publishedAt: "2026-06-01T00:00:00+00:00",
            sourceType: "company_8k",
          },
          processedSummary: {
            text: "NVIDIA reported record quarterly revenue.",
          },
          tickers: [{ symbol: "NVDA", role: "direct", confidence: 1 }],
          labels: [
            {
              type: "event",
              name: "results_of_operations",
            },
            {
              type: "domain",
              name: "ai",
            },
          ],
          sentiment: {
            polarity: "positive",
            score: 0.6,
          },
          filingRef: {
            secFilingId: "filing-1",
            accessionNumber: "0001045810-26-000123",
            sectionKey: "ex99.1",
          },
        },
      ],
      count: 1,
      nextCursor: "opaque-token",
    },
    meta: {
      creditsUsed: 1,
      remainingCredits: 99,
    },
  };
}

test("news_browse surfaces the trimmed public field set (thin wrapper)", async () => {
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
  // Parse first so schema defaults (label_mode: "any") apply as in production.
  const input = tool.parameters.parse({ ticker: "NVDA", labels: "domain:ai" });
  const payload = JSON.parse(await tool.execute(input)) as {
    summary: string;
    data: {
      items: Array<Record<string, unknown>>;
      count: number;
      nextCursor: string | null;
    };
    meta: Record<string, unknown>;
  };

  assert.match(payload.summary, /NVDA: 1 news article/);
  assert.equal(payload.data.items.length, 1);
  assert.equal("items" in payload, false);

  const item = payload.data.items[0]!;
  // Field set == trimmed public HTTP response (camelCase).
  assert.deepEqual(
    Object.keys(item).sort(),
    [
      "filingRef",
      "labels",
      "newsArticleId",
      "processedSummary",
      "sentiment",
      "source",
      "tickers",
      "title",
    ],
  );
  assert.deepEqual(item.filingRef, {
    secFilingId: "filing-1",
    accessionNumber: "0001045810-26-000123",
    sectionKey: "ex99.1",
  });

  // processedSummary is scrubbed of provenance and confidence: only text.
  const processedSummary = item.processedSummary as Record<string, unknown>;
  assert.deepEqual(Object.keys(processedSummary).sort(), ["text"]);
  assert.ok(!("source" in processedSummary));
  assert.ok(!("model" in processedSummary));
  assert.ok(!("promptVersion" in processedSummary));
  assert.ok(!("processedAt" in processedSummary));
  assert.ok(!("confidence" in processedSummary));

  // labels are scrubbed of source/model and the LLM confidence: only type/name.
  const labels = item.labels as Array<Record<string, unknown>>;
  assert.deepEqual(Object.keys(labels[0]!).sort(), ["name", "type"]);
  assert.ok(!("source" in labels[0]!));
  assert.ok(!("model" in labels[0]!));
  assert.ok(!("confidence" in labels[0]!));

  // sentiment is scrubbed of source and confidence: only polarity/score.
  const sentiment = item.sentiment as Record<string, unknown>;
  assert.deepEqual(Object.keys(sentiment).sort(), ["polarity", "score"]);
  assert.ok(!("source" in sentiment));
  assert.ok(!("confidence" in sentiment));

  // tickers keep the deterministic resolver match confidence (not an LLM label).
  const tickers = item.tickers as Array<Record<string, unknown>>;
  assert.equal(tickers[0]?.confidence, 1);

  // meta is now the credit envelope only; pagination moved into `data`.
  assert.deepEqual(Object.keys(payload.meta).sort(), [
    "creditsUsed",
    "remainingCredits",
  ]);
  assert.equal(payload.data.count, 1);
  assert.equal(payload.data.nextCursor, "opaque-token");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 99);
  assert.ok(!("servedFrom" in payload.meta));
  assert.ok(!("asOf" in payload.meta));
  assert.ok(!("taxonomyVersion" in payload.meta));

  assert.deepEqual(calls[0], {
    ticker: "NVDA",
    labels: "domain:ai",
    labelMode: "any",
    sourceType: undefined,
    startDate: undefined,
    endDate: undefined,
    limit: undefined,
    cursor: undefined,
  });
});

test("news_browse rejects calls without any pruning filter at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness
    .get("news_browse")
    .parameters.safeParse({ limit: 10 });
  assert.equal(result.success, false);
});

test("news_browse rejects unsupported label types at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    labels: "sector:energy",
  });
  assert.equal(result.success, false);
});

test("news_browse rejects malformed labels at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    labels: "domain:has space",
  });
  assert.equal(result.success, false);
});

test("news_browse rejects a lone start_date at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness
    .get("news_browse")
    .parameters.safeParse({ ticker: "NVDA", start_date: "2026-06-01" });
  assert.equal(result.success, false);
});

test("news_browse rejects invalid calendar dates at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    ticker: "NVDA",
    start_date: "2026-02-29",
    end_date: "2026-03-01",
  });
  assert.equal(result.success, false);
});

test("news_browse rejects reversed date ranges at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    ticker: "NVDA",
    start_date: "2026-06-09",
    end_date: "2026-06-01",
  });
  assert.equal(result.success, false);
});

test("news_browse rejects limit combined with a date range at parse stage", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    ticker: "NVDA",
    start_date: "2026-06-01",
    end_date: "2026-06-09",
    limit: 5,
  });
  assert.equal(result.success, false);
});

test("news_browse enforces the limit cap in the schema", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness
    .get("news_browse")
    .parameters.safeParse({ ticker: "NVDA", limit: 51 });
  assert.equal(result.success, false);
});

test("news_browse accepts a range query without limit", () => {
  const harness = createToolHarness();
  registerNewsBrowseTool(harness.server, {} as never);

  const result = harness.get("news_browse").parameters.safeParse({
    ticker: "NVDA",
    start_date: "2026-06-01",
    end_date: "2026-06-09",
  });
  assert.equal(result.success, true);
});
