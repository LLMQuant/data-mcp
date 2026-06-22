import assert from "node:assert/strict";
import test from "node:test";
import type { McpToolRegistry } from "./registry";

import { registerPersonalHoldingsTool } from "./personal-holdings";
import { registerPersonalProfileTool } from "./personal-profile";

function createToolHarness() {
  const tools = new Map<
    string,
    { description: string; execute: (input: unknown) => Promise<string> }
  >();

  return {
    server: {
      addTool(tool: {
        name: string;
        description: string;
        execute: (input: unknown) => Promise<string>;
      }) {
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

const HOLDINGS_RESPONSE = {
  data: {
    total_count: 2,
    holdings: [
      {
        symbol: "AAPL",
        name: "Apple Inc",
        asset_class: "equity",
        quantity: 10,
        market_value: 2000,
        cost_basis: 1500,
        currency: "USD",
        as_of_date: "2026-06-01",
      },
      {
        symbol: "BTC",
        name: "Bitcoin",
        asset_class: "crypto",
        quantity: 0.5,
        market_value: 30000,
        cost_basis: null,
        currency: "USD",
        as_of_date: null,
      },
    ],
  },
  meta: { creditsUsed: 0, remainingCredits: 7 },
};

const EMPTY_HOLDINGS_RESPONSE = {
  data: { total_count: 0, holdings: [] },
  meta: { creditsUsed: 0, remainingCredits: 7 },
};

const PROFILE_RESPONSE = {
  data: {
    risk_preference: "moderate",
    investment_horizon: "long_term",
    base_currency: "USD",
    extra_notes: "Prefers low turnover.",
  },
  meta: { creditsUsed: 0, remainingCredits: 7 },
};

const NULL_PROFILE_RESPONSE = {
  data: null,
  meta: { creditsUsed: 0, remainingCredits: 7 },
};

test("personal tool descriptions stay on the public surface (no DB/table/RPC terms)", () => {
  const harness = createToolHarness();
  const api = {} as never;
  registerPersonalHoldingsTool(harness.server, api);
  registerPersonalProfileTool(harness.server, api);

  const forbidden = /supabase|user_holdings|user_financial_contexts|rpc|table|admin client|sql/i;
  assert.doesNotMatch(harness.get("personal_holdings").description, forbidden);
  assert.doesNotMatch(harness.get("personal_profile").description, forbidden);
  // Residual-risk requirement: the description must say it reads the user's
  // own Profile-configured data.
  assert.match(harness.get("personal_holdings").description, /Profile/);
  assert.match(harness.get("personal_profile").description, /Profile/);
});

test("personal_holdings forwards asset_class + limit and passes data/meta through", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getPersonalHoldings(args: Record<string, unknown>) {
      captured.args = args;
      return HOLDINGS_RESPONSE;
    },
  } as never;

  registerPersonalHoldingsTool(harness.server, api);
  const raw = await harness
    .get("personal_holdings")
    .execute({ asset_class: "equity", limit: 25 });
  const parsed = JSON.parse(raw) as {
    summary: string;
    data: typeof HOLDINGS_RESPONSE.data;
    meta: typeof HOLDINGS_RESPONSE.meta;
  };

  assert.deepEqual(captured.args, { assetClass: "equity", limit: 25 });
  assert.equal(parsed.data.total_count, 2);
  assert.equal(parsed.data.holdings[0].symbol, "AAPL");
  assert.equal(parsed.meta.creditsUsed, 0);
  assert.match(parsed.summary, /2 saved holding/);
});

test("personal_holdings sends no filters when none are provided", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getPersonalHoldings(args: Record<string, unknown>) {
      captured.args = args;
      return EMPTY_HOLDINGS_RESPONSE;
    },
  } as never;

  registerPersonalHoldingsTool(harness.server, api);
  const raw = await harness.get("personal_holdings").execute({});
  const parsed = JSON.parse(raw) as { summary: string; data: { total_count: number } };

  assert.deepEqual(captured.args, {});
  assert.equal(parsed.data.total_count, 0);
  assert.match(parsed.summary, /No saved holdings/i);
});

test("personal_holdings propagates Web API errors as MCP errors", async () => {
  const harness = createToolHarness();
  const api = {
    async getPersonalHoldings() {
      throw new Error("boom");
    },
  } as never;
  registerPersonalHoldingsTool(harness.server, api);
  await assert.rejects(
    () => harness.get("personal_holdings").execute({}),
    /boom/,
  );
});

test("personal_profile passes data/meta through and summarizes a saved profile", async () => {
  const harness = createToolHarness();
  const captured: { called: boolean } = { called: false };
  const api = {
    async getPersonalProfile() {
      captured.called = true;
      return PROFILE_RESPONSE;
    },
  } as never;

  registerPersonalProfileTool(harness.server, api);
  const raw = await harness.get("personal_profile").execute({});
  const parsed = JSON.parse(raw) as {
    summary: string;
    data: typeof PROFILE_RESPONSE.data;
    meta: typeof PROFILE_RESPONSE.meta;
  };

  assert.equal(captured.called, true);
  assert.equal(parsed.data?.risk_preference, "moderate");
  assert.equal(parsed.meta.creditsUsed, 0);
  assert.match(parsed.summary, /Loaded your saved/i);
});

test("personal_profile surfaces a clear summary when no profile is saved", async () => {
  const harness = createToolHarness();
  const api = {
    async getPersonalProfile() {
      return NULL_PROFILE_RESPONSE;
    },
  } as never;
  registerPersonalProfileTool(harness.server, api);
  const raw = await harness.get("personal_profile").execute({});
  const parsed = JSON.parse(raw) as { summary: string; data: null };
  assert.equal(parsed.data, null);
  assert.match(parsed.summary, /No saved financial profile/i);
});

test("personal_profile propagates Web API errors as MCP errors", async () => {
  const harness = createToolHarness();
  const api = {
    async getPersonalProfile() {
      throw new Error("kaboom");
    },
  } as never;
  registerPersonalProfileTool(harness.server, api);
  await assert.rejects(
    () => harness.get("personal_profile").execute({}),
    /kaboom/,
  );
});
