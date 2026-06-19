import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import type { McpToolRegistry } from "./registry";

import { registerPolymarketEventBrowseTool } from "./polymarket-event-browse";
import { registerPolymarketEventReadTool } from "./polymarket-event-read";
import { registerPolymarketEventSearchTool } from "./polymarket-event-search";
import { registerPolymarketMarketReadTool } from "./polymarket-market-read";
import { registerPolymarketPriceHistoryTool } from "./polymarket-price-history";

type HarnessTool = {
  name: string;
  description?: string;
  parameters: z.ZodTypeAny;
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

function registerAllPolymarketTools(harness: ReturnType<typeof createToolHarness>, api: unknown) {
  registerPolymarketEventBrowseTool(harness.server, api as never);
  registerPolymarketEventSearchTool(harness.server, api as never);
  registerPolymarketEventReadTool(harness.server, api as never);
  registerPolymarketMarketReadTool(harness.server, api as never);
  registerPolymarketPriceHistoryTool(harness.server, api as never);
}

test("Prediction Markets tool descriptions avoid internal implementation terms", () => {
  const harness = createToolHarness();
  registerAllPolymarketTools(harness, {});

  for (const name of [
    "polymarket_event_browse",
    "polymarket_event_search",
    "polymarket_event_read",
    "polymarket_market_read",
    "polymarket_price_history",
  ]) {
    assert.doesNotMatch(
      harness.get(name).description ?? "",
      /\b(allowlist|seed|adapter|cache|cached|passthrough|透传)\b/i,
    );
  }

  assert.match(
    harness.get("polymarket_event_browse").description ?? "",
    /use polymarket_event_search first/i,
  );
});

test("Prediction Markets schemas enforce paired ranges and supported intervals", () => {
  const harness = createToolHarness();
  registerAllPolymarketTools(harness, {});

  assert.equal(
    harness.get("polymarket_event_browse").parameters.safeParse({
      status: "active",
      start_time: "2026-01-01T00:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    harness.get("polymarket_event_browse").parameters.safeParse({
      q: "x".repeat(201),
    }).success,
    false,
  );
  assert.equal(
    harness.get("polymarket_event_search").parameters.safeParse({
      query: "Bitcoin ETF approval",
      start_time: "2026-02-01T00:00:00Z",
      end_time: "2026-01-01T00:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    harness.get("polymarket_price_history").parameters.safeParse({
      outcome_token_id: "123",
      interval: "15m",
    }).success,
    false,
  );
});

test("polymarket_event_browse calls the Web API client and preserves events", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async browsePolymarketEvents(params: unknown) {
      calls.push(params);
      return {
        data: {
          events: [
            {
              eventCardId: "pme_902959",
              title: "Bitcoin ETF approval",
              marketCount: 1,
              markets: [{ marketCardId: "pmm_253254", marketQuestion: "Approved?" }],
            },
          ],
        },
        meta: { count: 1, nextCursor: null, scope: "finance", creditsUsed: 1 },
      };
    },
  };

  registerPolymarketEventBrowseTool(harness.server, api as never);
  const tool = harness.get("polymarket_event_browse");
  const input = tool.parameters.parse({
    status: "active",
    q: "Bitcoin ETF",
    tag: "crypto",
    min_volume: 10_000,
    min_liquidity: 1_000,
    limit: 3,
  });
  const payload = JSON.parse(await tool.execute(input)) as {
    summary: string;
    data: { events: Array<{ eventCardId: string }> };
    items: Array<{ eventCardId: string }>;
    meta: { creditsUsed: number; scope: string };
  };

  assert.match(payload.summary, /Found 1 finance prediction-market event/);
  assert.equal(payload.data.events[0]?.eventCardId, "pme_902959");
  assert.equal(payload.items[0]?.eventCardId, "pme_902959");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.scope, "finance");
  assert.deepEqual(calls[0], {
    status: "active",
    q: "Bitcoin ETF",
    tag: "crypto",
    asset: undefined,
    startTime: undefined,
    endTime: undefined,
    minVolume: 10_000,
    minLiquidity: 1_000,
    limit: 3,
    cursor: undefined,
  });
});

test("polymarket_event_search calls the semantic route and records query metadata", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async searchPolymarketEvents(params: unknown) {
      calls.push(params);
      return {
        data: {
          events: [
            {
              eventCardId: "pme_902959",
              title: "Bitcoin ETF approval",
              semanticScore: 0.91,
              markets: [],
            },
          ],
        },
        meta: { count: 1, creditsUsed: 2, remainingCredits: 98 },
      };
    },
  };

  registerPolymarketEventSearchTool(harness.server, api as never);
  const tool = harness.get("polymarket_event_search");
  const input = tool.parameters.parse({
    query: "Bitcoin ETF approval",
    tag: "crypto",
    limit: 5,
  });
  const payload = JSON.parse(await tool.execute(input)) as {
    items: Array<{ eventCardId: string; semanticScore: number }>;
    meta: { creditsUsed: number; query: string; limit: number };
  };

  assert.equal(payload.items[0]?.semanticScore, 0.91);
  assert.equal(payload.meta.creditsUsed, 2);
  assert.equal(payload.meta.query, "Bitcoin ETF approval");
  assert.equal(payload.meta.limit, 5);
  assert.deepEqual(calls[0], {
    query: "Bitcoin ETF approval",
    status: "active_or_recently_closed",
    tag: "crypto",
    startTime: undefined,
    endTime: undefined,
    limit: 5,
  });
});

test("polymarket_event_read and polymarket_market_read return item aliases", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async readPolymarketEvent(params: unknown) {
      calls.push(["event", params]);
      return {
        data: {
          eventCardId: "pme_902959",
          title: "Bitcoin ETF approval",
          marketCount: 1,
          markets: [{ marketCardId: "pmm_253254", marketQuestion: "Approved?" }],
        },
        meta: { creditsUsed: 0, remainingCredits: 99 },
      };
    },
    async readPolymarketMarket(params: unknown) {
      calls.push(["market", params]);
      return {
        data: {
          marketCardId: "pmm_253254",
          marketQuestion: "Approved by January?",
          outcomes: [{ label: "Yes", outcomeTokenId: "token-yes" }],
        },
        meta: { creditsUsed: 0, remainingCredits: 99 },
      };
    },
  };

  registerPolymarketEventReadTool(harness.server, api as never);
  registerPolymarketMarketReadTool(harness.server, api as never);

  const eventPayload = JSON.parse(
    await harness
      .get("polymarket_event_read")
      .execute({ event_card_id: "pme_902959" }),
  ) as { item: { eventCardId: string }; meta: { creditsUsed: number } };
  const marketPayload = JSON.parse(
    await harness
      .get("polymarket_market_read")
      .execute({ market_card_id: "pmm_253254" }),
  ) as { item: { marketCardId: string; outcomes: Array<{ outcomeTokenId: string }> } };

  assert.equal(eventPayload.item.eventCardId, "pme_902959");
  assert.equal(eventPayload.meta.creditsUsed, 0);
  assert.equal(marketPayload.item.marketCardId, "pmm_253254");
  assert.equal(marketPayload.item.outcomes[0]?.outcomeTokenId, "token-yes");
  assert.deepEqual(calls, [
    ["event", { eventCardId: "pme_902959" }],
    ["market", { marketCardId: "pmm_253254" }],
  ]);
});

test("polymarket_price_history forwards range and limit without dropping the cap", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async getPolymarketPriceHistory(params: unknown) {
      calls.push(params);
      return {
        data: {
          outcomeTokenId: "token-yes",
          interval: "1d",
          points: [{ time: "2024-01-01T00:00:00Z", probability: 0.51, price: 0.51 }],
          coverageStatus: "partial",
          coverageNotice: "Partial daily coverage.",
        },
        meta: { count: 1, creditsUsed: 0, remainingCredits: 99 },
      };
    },
  };

  registerPolymarketPriceHistoryTool(harness.server, api as never);
  const tool = harness.get("polymarket_price_history");
  const input = tool.parameters.parse({
    outcome_token_id: "token-yes",
    interval: "1d",
    start_time: "2024-01-01T00:00:00Z",
    end_time: "2024-01-15T00:00:00Z",
    limit: 10,
  });
  const payload = JSON.parse(await tool.execute(input)) as {
    summary: string;
    item: { outcomeTokenId: string; points: Array<{ probability: number }> };
    meta: { creditsUsed: number };
  };

  assert.match(payload.summary, /1d probability history: 1 point/);
  assert.equal(payload.item.outcomeTokenId, "token-yes");
  assert.equal(payload.item.points[0]?.probability, 0.51);
  assert.equal(payload.meta.creditsUsed, 0);
  assert.deepEqual(calls[0], {
    outcomeTokenId: "token-yes",
    interval: "1d",
    startTime: "2024-01-01T00:00:00Z",
    endTime: "2024-01-15T00:00:00Z",
    limit: 10,
  });
});
