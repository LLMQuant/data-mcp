import assert from "node:assert/strict";
import test from "node:test";
import type { McpToolRegistry } from "./registry";

import { LlmquantApiError } from "../shared/errors";
import { registerSearchWikiTool } from "./search-wiki";
import { registerReadWikiTool } from "./read-wiki";

function createToolHarness() {
  const tools = new Map<string, { execute: (input: unknown) => Promise<string> }>();

  return {
    server: {
      addTool(tool: { name: string; execute: (input: unknown) => Promise<string> }) {
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

test("wiki_search forwards Web data and credit metadata", async () => {
  const harness = createToolHarness();
  const calls: unknown[] = [];
  const api = {
    async searchWiki(params: unknown) {
      calls.push(params);
      return {
        data: [
          {
            wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            slug: "black-scholes",
            title: "Black-Scholes Model",
            summary: "Option pricing model",
            tags: ["options", "derivatives"],
            semanticScore: 0.91234,
            lexicalScore: 0.82345,
            combinedScore: 0.87891,
          },
        ],
        meta: {
          remainingCredits: 42,
          creditsUsed: 1,
        },
      };
    },
  };

  registerSearchWikiTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("wiki_search").execute({
      query: "option pricing",
      limit: 5,
    }),
  ) as {
    summary: string;
    data: Array<{ semanticScore: number; lexicalScore: number; combinedScore: number }>;
    meta: { creditsUsed: number; remainingCredits: number };
  };

  assert.match(payload.summary, /Found 1 wiki result/);
  assert.equal(payload.data[0]?.semanticScore, 0.91234);
  assert.equal(payload.data[0]?.lexicalScore, 0.82345);
  assert.equal(payload.data[0]?.combinedScore, 0.87891);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 42);
  assert.equal("items" in payload, false);
  assert.deepEqual(calls[0], { query: "option pricing", limit: 5 });
});

test("wiki_search returns appropriate summary when no results found", async () => {
  const harness = createToolHarness();
  const api = {
    async searchWiki() {
      return {
        data: [],
        meta: { remainingCredits: 41, creditsUsed: 1 },
      };
    },
  };

  registerSearchWikiTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("wiki_search").execute({ query: "nonexistent topic", limit: 5 }),
  ) as { summary: string; data: unknown[] };

  assert.match(payload.summary, /No wiki results found/);
  assert.equal(payload.data.length, 0);
  assert.equal("items" in payload, false);
});

test("wiki_search surfaces API failures without URL context", async () => {
  const harness = createToolHarness();
  const api = {
    async searchWiki() {
      throw new LlmquantApiError({
        message: "Rate limit exceeded",
        status: 429,
        url: "https://api.llmquantdata.test/api/wiki/search",
        code: "rate_limited",
      });
    },
  };

  registerSearchWikiTool(harness.server, api as never);

  // Web owns the public error phrasing; MCP forwards `message` verbatim with no
  // appended status/url decoration (response-contract.md §九).
  await assert.rejects(
    () =>
      harness.get("wiki_search").execute({
        query: "option pricing",
        limit: 5,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Rate limit exceeded");
      assert.doesNotMatch(error.message, /status|429|api\.llmquantdata/i);
      return true;
    },
  );
});

test("wiki_read forwards item data and Web metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async readWikiItem({ maxLength }: { wikiItemId: string; maxLength?: number }) {
      const fullBody = "# Black-Scholes\n\nThe Black-Scholes model is...";
      const body = maxLength != null ? fullBody.slice(0, maxLength) : fullBody;

      return {
        data: {
          wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          slug: "black-scholes",
          title: "Black-Scholes Model",
          summary: "Option pricing model",
          bodyMarkdown: body,
          tags: ["options"],
          aliases: ["BS model"],
          relatedConcepts: ["implied-volatility"],
          sourceUpdatedAt: "2026-03-01T00:00:00Z",
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "2026-03-15T00:00:00Z",
        },
        meta: {
          creditsUsed: 0,
          remainingCredits: 42,
        },
      };
    },
  };

  registerReadWikiTool(harness.server, api as never);

  // Test with maxLength that triggers truncation
  const payload = JSON.parse(
    await harness.get("wiki_read").execute({
      wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      maxLength: 20,
    }),
  ) as {
    summary: string;
    data: { bodyMarkdown: string };
    meta: {
      creditsUsed: number;
      remainingCredits: number;
    };
  };

  assert.match(payload.summary, /Black-Scholes Model/);
  assert.equal(payload.data.bodyMarkdown.length, 20);
  assert.equal(payload.meta.creditsUsed, 0);
  assert.equal(payload.meta.remainingCredits, 42);
  assert.equal("item" in payload, false);
});

test("wiki_read does not add MCP-only truncation metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async readWikiItem() {
      return {
        data: {
          wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          slug: "black-scholes",
          title: "Black-Scholes Model",
          summary: "Option pricing model",
          bodyMarkdown: "# Full content",
          tags: [],
          aliases: [],
          relatedConcepts: [],
          sourceUpdatedAt: null,
          createdAt: "2026-03-01T00:00:00Z",
          updatedAt: "2026-03-01T00:00:00Z",
        },
        meta: {
          creditsUsed: 0,
          remainingCredits: 41,
        },
      };
    },
  };

  registerReadWikiTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("wiki_read").execute({
      wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }),
  ) as {
    meta: {
      remainingCredits: number;
    };
  };

  assert.equal(payload.meta.remainingCredits, 41);
  assert.equal("possiblyTruncated" in payload.meta, false);
  assert.equal("requestedMaxLength" in payload.meta, false);
});
