import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

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

test("wiki_search formats items with rounded scores and credit metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async searchWiki() {
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
          topK: 5,
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
      topK: 5,
    }),
  ) as {
    summary: string;
    items: Array<{ scores: { combined: number; semantic: number; lexical: number } }>;
    meta: { creditsUsed: number; remainingCredits: number };
  };

  assert.match(payload.summary, /Found 1 wiki result/);
  assert.equal(payload.items[0]?.scores.semantic, 0.9123);
  assert.equal(payload.items[0]?.scores.lexical, 0.8235);
  assert.equal(payload.items[0]?.scores.combined, 0.8789);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 42);
});

test("wiki_search returns appropriate summary when no results found", async () => {
  const harness = createToolHarness();
  const api = {
    async searchWiki() {
      return {
        data: [],
        meta: { topK: 5, remainingCredits: 41, creditsUsed: 1 },
      };
    },
  };

  registerSearchWikiTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("wiki_search").execute({ query: "nonexistent topic", topK: 5 }),
  ) as { summary: string; items: unknown[] };

  assert.match(payload.summary, /No wiki results found/);
  assert.equal(payload.items.length, 0);
});

test("wiki_search surfaces API failures with status and URL context", async () => {
  const harness = createToolHarness();
  const api = {
    async searchWiki() {
      throw new LlmquantApiError({
        message: "Rate limit exceeded",
        status: 429,
        url: "https://api.llmquantdata.test/api/wiki/search",
      });
    },
  };

  registerSearchWikiTool(harness.server, api as never);

  await assert.rejects(
    () =>
      harness.get("wiki_search").execute({
        query: "option pricing",
        topK: 5,
      }),
    /Rate limit exceeded \(status 429, url: https:\/\/api\.llmquantdata\.test\/api\/wiki\/search\)/,
  );
});

test("wiki_read returns item with truncation metadata", async () => {
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
    item: { bodyMarkdown: string };
    meta: {
      creditsUsed: number;
      returnedBodyLength: number;
      possiblyTruncated: boolean;
      requestedMaxLength: number | null;
    };
  };

  assert.match(payload.summary, /Black-Scholes Model/);
  assert.equal(payload.meta.creditsUsed, 0);
  assert.equal(payload.meta.returnedBodyLength, 20);
  assert.equal(payload.meta.possiblyTruncated, true);
  assert.equal(payload.meta.requestedMaxLength, 20);
});

test("wiki_read reports possiblyTruncated=false when maxLength is not set", async () => {
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
      };
    },
  };

  registerReadWikiTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("wiki_read").execute({
      wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }),
  ) as {
    meta: { possiblyTruncated: boolean; requestedMaxLength: number | null };
  };

  assert.equal(payload.meta.possiblyTruncated, false);
  assert.equal(payload.meta.requestedMaxLength, null);
});
