import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";

import type { ApiClientProvider } from "./client/api-provider";
import type { McpToolRegistry } from "./tools/registry";
import { registerLlmquantDataTools } from "./register-tools";

function createToolHarness() {
  const names = new Set<string>();
  const tools = new Map<
    string,
    {
      parameters: z.ZodTypeAny;
      execute: (args: unknown, context?: unknown) => unknown | Promise<unknown>;
    }
  >();

  return {
    server: {
      addTool(tool: {
        name: string;
        parameters: z.ZodTypeAny;
        execute: (args: unknown, context?: unknown) => unknown | Promise<unknown>;
      }) {
        names.add(tool.name);
        tools.set(tool.name, {
          parameters: tool.parameters,
          execute: tool.execute,
        });
      },
    } as McpToolRegistry,
    names,
    get(name: string) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }
      return tool;
    },
  };
}

test("registerLlmquantDataTools registers news_browse unconditionally", () => {
  const harness = createToolHarness();

  registerLlmquantDataTools(harness.server, {} as ApiClientProvider);

  assert.ok(harness.names.has("news_browse"));
  assert.ok(harness.names.has("sec_filing_browse"));
  assert.ok(harness.names.has("polymarket_event_browse"));
  assert.ok(harness.names.has("polymarket_event_search"));
  assert.ok(harness.names.has("polymarket_event_read"));
  assert.ok(harness.names.has("polymarket_market_read"));
  assert.ok(harness.names.has("polymarket_price_history"));
  assert.ok(harness.names.has("personal_holdings"));
  assert.ok(harness.names.has("personal_profile"));
});

test("registerLlmquantDataTools rejects unknown legacy fields before execution", async () => {
  const harness = createToolHarness();
  const api = {
    searchWiki() {
      throw new Error("should not call api when input is invalid");
    },
    getMacroIndicators() {
      throw new Error("should not call api when input is invalid");
    },
  };

  registerLlmquantDataTools(harness.server, api as unknown as ApiClientProvider);

  assert.equal(
    harness.get("wiki_search").parameters.safeParse({ query: "risk parity", topK: 10 }).success,
    false,
  );
  assert.equal(
    harness.get("macro_indicator_search").parameters.safeParse({ q: "cpi" }).success,
    false,
  );
  await assert.rejects(
    async () => harness.get("wiki_search").execute({ query: "risk parity", topK: 10 }),
    /Unrecognized parameter\(s\)/u,
  );
});

test("registerLlmquantDataTools names the replacement for renamed parameters", () => {
  const harness = createToolHarness();

  registerLlmquantDataTools(harness.server, {} as ApiClientProvider);

  const messageFor = (name: string, input: unknown) => {
    const result = harness.get(name).parameters.safeParse(input);
    assert.equal(result.success, false);
    return result.success ? "" : result.error.issues[0].message;
  };

  // B7/B8: the old names are rejected, and the message must say what to send
  // instead instead of zod's bare `Unrecognized key: "topK"`.
  assert.equal(
    messageFor("wiki_search", { query: "risk parity", topK: 10 }),
    'Unrecognized parameter(s): "topK" was renamed to "limit".',
  );
  assert.equal(
    messageFor("paper_search", { query: "momentum", topK: 10 }),
    'Unrecognized parameter(s): "topK" was renamed to "limit".',
  );
  assert.equal(
    messageFor("macro_indicator_search", { q: "cpi" }),
    'Unrecognized parameter(s): "q" was renamed to "query".',
  );
  assert.equal(
    messageFor("polymarket_event_browse", { q: "bitcoin" }),
    'Unrecognized parameter(s): "q" was renamed to "query".',
  );
  // Unknown keys with no known replacement still get a public-safe message.
  assert.equal(
    messageFor("wiki_search", { query: "a", topK: 1, nonsense: true }),
    'Unrecognized parameter(s): "topK" was renamed to "limit"; "nonsense" is not a supported parameter.',
  );
  // B12: withdrawn parameters are rejected rather than silently ignored.
  assert.equal(
    messageFor("polymarket_event_search", {
      query: "Bitcoin ETF approval",
      start_time: "2026-01-01T00:00:00Z",
      end_time: "2026-02-01T00:00:00Z",
    }),
    'Unrecognized parameter(s): "start_time" is not a supported parameter; "end_time" is not a supported parameter.',
  );
});

test("registerLlmquantDataTools rejects take_from=earliest without a start boundary at parse time", () => {
  const harness = createToolHarness();

  registerLlmquantDataTools(harness.server, {} as ApiClientProvider);

  // tool-query-contract.md §2.2: this must fail as invalid params (parse
  // stage), matching the hosted registry's error envelope — not only inside
  // execute().
  const dateSeries: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ["equity_historical_prices", { ticker: "AAPL" }, { start_date: "2026-06-01" }],
    [
      "equity_intraday_prices",
      { ticker: "AAPL" },
      // Intraday also caps the effective window at 14 calendar days, so the
      // "valid" probe has to carry an explicit in-range end_date.
      { start_date: "2026-06-01", end_date: "2026-06-10" },
    ],
    ["macro_indicator_history", { indicator: "us.cpi.headline" }, { start_date: "2026-06-01" }],
  ];

  for (const [name, base, validWindow] of dateSeries) {
    const result = harness
      .get(name)
      .parameters.safeParse({ ...base, take_from: "earliest" });
    assert.equal(result.success, false, name);
    assert.equal(
      result.success ? "" : result.error.issues[0].message,
      "take_from=earliest requires start_date.",
      name,
    );
    assert.equal(
      harness
        .get(name)
        .parameters.safeParse({ ...base, ...validWindow, take_from: "earliest" }).success,
      true,
      name,
    );
  }

  const timeSeries: Array<[string, Record<string, unknown>]> = [
    ["crypto_historical_klines", { ticker: "BTC-USD", interval: "1h" }],
    ["polymarket_price_history", { outcome_token_id: "123", interval: "1h" }],
  ];

  for (const [name, base] of timeSeries) {
    const result = harness
      .get(name)
      .parameters.safeParse({ ...base, take_from: "earliest" });
    assert.equal(result.success, false, name);
    assert.equal(
      result.success ? "" : result.error.issues[0].message,
      "take_from=earliest requires start_time.",
      name,
    );
    assert.equal(
      harness
        .get(name)
        .parameters.safeParse({
          ...base,
          take_from: "earliest",
          start_time: "2026-06-01T00:00:00Z",
        }).success,
      true,
      name,
    );
  }
});
