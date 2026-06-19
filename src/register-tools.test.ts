import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";

import type { ApiClientProvider } from "./client/api-provider";
import type { McpToolRegistry } from "./tools/registry";
import { registerLlmquantDataTools } from "./register-tools";

function createToolHarness() {
  const names = new Set<string>();

  return {
    server: {
      addTool(tool: { name: string; parameters: z.ZodTypeAny }) {
        void tool.parameters;
        names.add(tool.name);
      },
    } as McpToolRegistry,
    names,
  };
}

function withNewsApiEnabled(value: string | undefined, run: () => void) {
  const previous = process.env.NEWS_API_ENABLED;
  if (value === undefined) {
    delete process.env.NEWS_API_ENABLED;
  } else {
    process.env.NEWS_API_ENABLED = value;
  }

  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env.NEWS_API_ENABLED;
    } else {
      process.env.NEWS_API_ENABLED = previous;
    }
  }
}

test("registerLlmquantDataTools registers news_browse when NEWS_API_ENABLED is true", () => {
  const harness = createToolHarness();

  withNewsApiEnabled("true", () => {
    registerLlmquantDataTools(harness.server, {} as ApiClientProvider);
  });

  assert.ok(harness.names.has("news_browse"));
});

test("registerLlmquantDataTools omits news_browse when NEWS_API_ENABLED is unset (default OFF)", () => {
  const harness = createToolHarness();

  withNewsApiEnabled(undefined, () => {
    registerLlmquantDataTools(harness.server, {} as ApiClientProvider);
  });

  assert.equal(harness.names.has("news_browse"), false);
  // Other tools still register regardless of the news flag.
  assert.ok(harness.names.has("sec_filing_browse"));
  assert.ok(harness.names.has("polymarket_event_browse"));
  assert.ok(harness.names.has("polymarket_event_search"));
  assert.ok(harness.names.has("polymarket_event_read"));
  assert.ok(harness.names.has("polymarket_market_read"));
  assert.ok(harness.names.has("polymarket_price_history"));
});

test("registerLlmquantDataTools omits news_browse when NEWS_API_ENABLED is not exactly 'true'", () => {
  const harness = createToolHarness();

  withNewsApiEnabled("1", () => {
    registerLlmquantDataTools(harness.server, {} as ApiClientProvider);
  });

  assert.equal(harness.names.has("news_browse"), false);
});
