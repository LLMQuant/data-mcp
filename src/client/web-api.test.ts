import assert from "node:assert/strict";
import test from "node:test";

import { LlmquantWebApiClient } from "./web-api";
import { LlmquantApiError, LlmquantTransportError } from "../shared/errors";

const env = {
  apiKey: "test-api-key",
  baseUrl: "https://api.llmquantdata.test",
  timeoutMs: 1_500,
};

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

test("searchPaper posts to the paper search route and maps snake_case fields", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });

    return jsonResponse({
      data: [
        {
          paper_card_id: "11111111-1111-1111-1111-111111111111",
          source_paper_id: "manual_arxiv:2401.00001",
          title: "Paper Title",
          authors: ["Alice", "Bob"],
          abstract: "Abstract",
          summary: "Summary",
          tags: ["ml"],
          available_sections: [
            {
              section_key: "introduction",
              section_type: "introduction",
              title: "Introduction",
              char_count: 120,
              section_order: 1,
            },
          ],
          section_count: 1,
          full_text_char_count: 120,
          pdf_url: "https://example.com/paper.pdf",
          semantic_score: 0.91234,
        },
      ],
      meta: {
        topK: 3,
        remainingCredits: 41,
        creditsUsed: 1,
      },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.searchPaper({
      query: "transformer finance",
      topK: 3,
    });

    assert.equal(calls[0]?.url, "https://api.llmquantdata.test/api/paper/search");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      query: "transformer finance",
      topK: 3,
    });

    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-api-key");
    assert.equal(response.meta.remainingCredits, 41);
    assert.deepEqual(response.data[0], {
      paperCardId: "11111111-1111-1111-1111-111111111111",
      sourcePaperId: "manual_arxiv:2401.00001",
      title: "Paper Title",
      authors: ["Alice", "Bob"],
      abstract: "Abstract",
      summary: "Summary",
      tags: ["ml"],
      availableSections: [
        {
          sectionKey: "introduction",
          sectionType: "introduction",
          title: "Introduction",
          charCount: 120,
          sectionOrder: 1,
        },
      ],
      sectionCount: 1,
      fullTextCharCount: 120,
      pdfUrl: "https://example.com/paper.pdf",
      semanticScore: 0.91234,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

test("searchWiki posts to the wiki search route and maps snake_case fields", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });

    return jsonResponse({
      data: [
        {
          wiki_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          slug: "black-scholes",
          title: "Black-Scholes Model",
          summary: "Option pricing model",
          tags: ["options"],
          semantic_score: 0.912,
          lexical_score: 0.823,
          combined_score: 0.878,
        },
      ],
      meta: {
        topK: 5,
        remainingCredits: 42,
        creditsUsed: 1,
      },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.searchWiki({ query: "option pricing", topK: 5 });

    assert.equal(calls[0]?.url, "https://api.llmquantdata.test/api/wiki/search");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      query: "option pricing",
      topK: 5,
    });

    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-api-key");
    assert.equal(response.data[0]?.wikiItemId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.equal(response.data[0]?.slug, "black-scholes");
    assert.equal(response.data[0]?.semanticScore, 0.912);
    assert.equal(response.meta.creditsUsed, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readWikiItem builds URL with maxLength query parameter", async () => {
  const calls: Array<{ url: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    calls.push({ url: String(input) });

    return jsonResponse({
      data: {
        wiki_item_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        slug: "black-scholes",
        title: "Black-Scholes Model",
        summary: "Option pricing model",
        body_markdown: "# Black-Scholes",
        tags: ["options"],
        aliases: ["BS model"],
        related_concepts: ["implied-volatility"],
        source_updated_at: "2026-03-01T00:00:00Z",
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-15T00:00:00Z",
      },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.readWikiItem({
      wikiItemId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      maxLength: 500,
    });

    const url = new URL(calls[0]!.url);
    assert.match(url.pathname, /\/api\/wiki\/items\/aaaaaaaa/);
    assert.equal(url.searchParams.get("max_length"), "500");
    assert.equal(response.data.wikiItemId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.equal(response.data.bodyMarkdown, "# Black-Scholes");
    assert.deepEqual(response.data.aliases, ["BS model"]);
    assert.deepEqual(response.data.relatedConcepts, ["implied-volatility"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

test("getCryptoHistorical builds query params and returns kline data", async () => {
  const calls: Array<{ url: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    calls.push({ url: String(input) });

    return jsonResponse({
      data: {
        ticker: "BTC-USD",
        interval: "1d",
        prices: [
          { open: 87000, high: 87500, low: 86800, close: 87200, volume: 1234, time: "2026-03-28T00:00:00Z" },
        ],
      },
      meta: { count: 1, creditsUsed: 1, remainingCredits: 99 },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.getCryptoHistorical({
      ticker: "BTC-USD",
      interval: "1d",
      startTime: "2026-03-28T00:00:00Z",
      endTime: "2026-03-29T00:00:00Z",
      limit: 10,
    });

    const url = new URL(calls[0]!.url);
    assert.equal(url.pathname, "/api/crypto/historical");
    assert.equal(url.searchParams.get("ticker"), "BTC-USD");
    assert.equal(url.searchParams.get("interval"), "1d");
    assert.equal(url.searchParams.get("start_time"), "2026-03-28T00:00:00Z");
    assert.equal(url.searchParams.get("end_time"), "2026-03-29T00:00:00Z");
    assert.equal(url.searchParams.get("limit"), "10");
    assert.equal(response.data.ticker, "BTC-USD");
    assert.equal(response.data.prices.length, 1);
    assert.equal(response.meta.count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getCryptoSnapshot maps snake_case response fields to camelCase", async () => {
  const calls: Array<{ url: string }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    calls.push({ url: String(input) });

    return jsonResponse({
      data: {
        price: 87500.25,
        ticker: "BTC-USD",
        day_change: 1200.5,
        day_change_percent: 1.39,
        volume_24h: 28500.75,
        time: "2026-03-30T12:00:00Z",
      },
      meta: { creditsUsed: 1, remainingCredits: 97 },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.getCryptoSnapshot({ ticker: "BTC-USD" });

    const url = new URL(calls[0]!.url);
    assert.equal(url.pathname, "/api/crypto/snapshot");
    assert.equal(url.searchParams.get("ticker"), "BTC-USD");
    assert.equal(response.data.price, 87500.25);
    assert.equal(response.data.dayChange, 1200.5);
    assert.equal(response.data.dayChangePercent, 1.39);
    assert.equal(response.data.volume24h, 28500.75);
    assert.equal(response.meta.creditsUsed, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request converts non-OK responses into LlmquantApiError", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    jsonResponse(
      {
        error: "Rate limit exceeded",
      },
      { status: 429 },
    )) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);

    await assert.rejects(
      () => client.searchWiki({ query: "option pricing", topK: 5 }),
      (error: unknown) => {
        assert.ok(error instanceof LlmquantApiError);
        assert.equal(error.message, "Rate limit exceeded");
        assert.equal(error.status, 429);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("request converts fetch failures into LlmquantTransportError", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("connect ECONNREFUSED");
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);

    await assert.rejects(
      () => client.getCryptoSnapshot({ ticker: "BTC-USD" }),
      (error: unknown) => {
        assert.ok(error instanceof LlmquantTransportError);
        assert.match(error.message, /ECONNREFUSED/);
        assert.equal(
          error.url,
          "https://api.llmquantdata.test/api/crypto/snapshot?ticker=BTC-USD",
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ---------------------------------------------------------------------------
// Paper (existing tests)
// ---------------------------------------------------------------------------

test("readPaper posts to the paper read route and maps nested sections", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });

    return jsonResponse({
      data: {
        paper_card_id: "11111111-1111-1111-1111-111111111111",
        source_paper_id: "manual_arxiv:2401.00001",
        title: "Paper Title",
        authors: ["Alice", "Bob"],
        abstract: "Abstract",
        summary: "Summary",
        tags: ["ml"],
        pdf_url: "https://example.com/paper.pdf",
        section_count: 2,
        full_text_char_count: 340,
        available_sections: [
          {
            section_key: "introduction",
            section_type: "introduction",
            title: "Introduction",
            char_count: 120,
            section_order: 1,
          },
          {
            section_key: "results",
            section_type: "results",
            title: "Results",
            char_count: 220,
            section_order: 2,
          },
        ],
        source_updated_at: "2026-03-24T00:00:00Z",
        created_at: "2026-03-24T00:00:00Z",
        updated_at: "2026-03-24T00:00:00Z",
        sections: [
          {
            paper_card_id: "11111111-1111-1111-1111-111111111111",
            section_key: "results",
            section_type: "results",
            title: "Results",
            section_order: 2,
            body_markdown: "## Results",
            char_count: 220,
          },
        ],
      },
    });
  }) as typeof fetch;

  try {
    const client = new LlmquantWebApiClient(env);
    const response = await client.readPaper({
      paperCardId: "11111111-1111-1111-1111-111111111111",
      sections: ["results"],
    });

    assert.equal(calls[0]?.url, "https://api.llmquantdata.test/api/paper/read");
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      paperCardId: "11111111-1111-1111-1111-111111111111",
      sections: ["results"],
    });
    assert.equal(response.data.sections[0]?.bodyMarkdown, "## Results");
    assert.equal(response.data.availableSections[1]?.sectionKey, "results");
    assert.equal(response.data.fullTextCharCount, 340);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
