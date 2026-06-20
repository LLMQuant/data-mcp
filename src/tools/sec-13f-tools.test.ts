import assert from "node:assert/strict";
import test from "node:test";
import type { McpToolRegistry } from "./registry";

import { registerSec13fByManagerTool } from "./sec-13f-by-manager";
import { registerSec13fByTickerTool } from "./sec-13f-by-ticker";
import { registerSec13fListTopManagersTool } from "./sec-13f-list-top-managers";

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

// New unified envelope (contexts/project/api/response-contract.md §三): the 13F
// `meta.scope` object and `meta.scope_notice` are gone. The only meta fields are
// creditsUsed / remainingCredits / optional `notice`. "No data" / out-of-scope
// explanations now arrive as a 200 + (possibly empty) data + a server-rendered
// `meta.notice`, which MCP forwards verbatim (never synthesizes itself).

test("sec_13f_list_manager_holdings forwards (year, quarter) and surfaces holdings summary", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getSec13fByManager(args: Record<string, unknown>) {
      captured.args = args;
      return {
        data: {
          ranking_period: "2025-12-31",
          manager: {
            manager_cik: "1067983",
            manager_name: "BERKSHIRE HATHAWAY INC",
            match_type: "alias" as const,
            latest_reportable_value_usd: 302_459_211_458,
            latest_reportable_value_period: "2025-12-31",
            period_rank: 7,
            period_reportable_value_usd: 302_459_211_458,
            is_in_covered_manager_set: true,
          },
          filing: {
            filing_type: "13F-HR",
            accession_number: "0000950123-26-001234",
            filed_at: "2026-02-14",
            period_of_report: "2025-12-31",
            is_amendment: false,
            table_entry_total: 110,
            table_value_total: 302_459_211_458,
            filing_url: "https://www.sec.gov/test.html",
          },
          holdings: [
            {
              cusip: "025816109",
              ticker: "AXP",
              name_of_issuer: "AMERICAN EXPRESS CO",
              title_of_class: "COM",
              value_usd: 55_145_133_598,
              shares: 149_061_045,
              shares_type: "SH" as const,
              investment_discretion: "SOLE",
              voting_sole: 149_061_045,
              voting_shared: 0,
              voting_none: 0,
              put_call: null,
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSec13fByManagerTool(harness.server, api as never);
  const raw = await harness.get("sec_13f_list_manager_holdings").execute({
    manager_name: "Berkshire",
    year: 2025,
    quarter: 4,
    limit: 200,
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    item: {
      ranking_period: string | null;
      manager: { manager_cik: string; period_rank: number };
      holdings: Array<{ ticker: string | null }>;
    };
    meta: { creditsUsed: number; remainingCredits: number; notice?: string };
  };

  assert.equal(captured.args?.year, 2025);
  assert.equal(captured.args?.quarter, 4);
  // No notice → guidance line built purely from public data (filing + count).
  assert.match(payload.summary, /2025-12-31/);
  assert.match(payload.summary, /1 holdings/);
  assert.equal(payload.item.ranking_period, "2025-12-31");
  assert.equal(payload.item.manager.manager_cik, "1067983");
  assert.equal(payload.item.manager.period_rank, 7);
  assert.equal(payload.item.holdings[0]?.ticker, "AXP");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 99);
  // scope / scope_notice no longer exist on meta.
  assert.equal("scope" in payload.meta, false);
  assert.doesNotMatch(raw, /scope_notice|"scope"|available_ranking_periods/);
});

test("sec_13f_list_manager_holdings rejects requests with neither cik nor name", async () => {
  const harness = createToolHarness();
  const api = {
    async getSec13fByManager() {
      throw new Error("should not be called");
    },
  };

  registerSec13fByManagerTool(harness.server, api as never);

  await assert.rejects(
    harness.get("sec_13f_list_manager_holdings").execute({}),
    /At least one of manager_cik or manager_name/,
  );
});

test("sec_13f_list_manager_holdings forwards out-of-scope notice verbatim", async () => {
  const harness = createToolHarness();
  const NOTICE =
    "Manager CIK 9999 is outside the covered Top 1,000 manager set; no holdings available.";
  const api = {
    async getSec13fByManager() {
      return {
        data: {
          ranking_period: null,
          manager: {
            manager_cik: "9999",
            manager_name: "",
            match_type: "cik" as const,
            latest_reportable_value_usd: 0,
            latest_reportable_value_period: null,
            period_rank: null,
            period_reportable_value_usd: null,
            is_in_covered_manager_set: false,
          },
          filing: null,
          holdings: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          notice: NOTICE,
        },
      };
    },
  };

  registerSec13fByManagerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_manager_holdings").execute({
      manager_cik: "9999",
    }),
  ) as { summary: string; item: { holdings: unknown[] }; meta: { notice?: string } };

  // The notice is the human line; MCP no longer derives prose from
  // is_in_covered_manager_set.
  assert.equal(payload.summary, NOTICE);
  assert.equal(payload.meta.notice, NOTICE);
  assert.equal(payload.item.holdings.length, 0);
});

test("sec_13f_list_ticker_holders forwards (year, quarter) and formats holder summary", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async getSec13fByTicker(args: Record<string, unknown>) {
      captured.args = args;
      return {
        data: {
          ticker: "NVDA",
          ranking_period: "2025-12-31",
          total_holders_in_scope: 187,
          aggregate_value_usd: 123_456_789_000,
          holders: [
            {
              manager_cik: "1067983",
              manager_name: "BERKSHIRE HATHAWAY INC",
              manager_period_reportable_value_usd: 302_459_211_458,
              manager_period_of_report: "2025-12-31",
              manager_period_rank: 7,
              accession_number: "0000950123-26-001234",
              cusip: "67066G104",
              title_of_class: "COM",
              value_usd: 1_234_567_890,
              shares: 9_000_000,
              shares_type: "SH" as const,
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSec13fByTickerTool(harness.server, api as never);
  const raw = await harness.get("sec_13f_list_ticker_holders").execute({
    ticker: "NVDA",
    year: 2025,
    quarter: 4,
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    item: { ticker: string; ranking_period: string | null; total_holders_in_scope: number };
    meta: { creditsUsed: number; remainingCredits: number; notice?: string };
  };

  assert.equal(captured.args?.year, 2025);
  assert.equal(captured.args?.quarter, 4);
  // No notice → guidance line built purely from public data (count + period).
  assert.match(payload.summary, /NVDA 2025-12-31/);
  assert.match(payload.summary, /187 holders/);
  assert.equal(payload.item.ticker, "NVDA");
  assert.equal(payload.item.ranking_period, "2025-12-31");
  assert.equal(payload.item.total_holders_in_scope, 187);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal("scope" in payload.meta, false);
  assert.doesNotMatch(raw, /scope_notice|"scope"|available_ranking_periods/);
});

test("sec_13f_list_ticker_holders forwards no-hit notice verbatim", async () => {
  const harness = createToolHarness();
  const NOTICE =
    "No Top 1,000 managers held XYZZZ in 2025-12-31.";
  const api = {
    async getSec13fByTicker() {
      return {
        data: {
          ticker: "XYZZZ",
          ranking_period: "2025-12-31",
          total_holders_in_scope: 0,
          aggregate_value_usd: 0,
          holders: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          notice: NOTICE,
        },
      };
    },
  };

  registerSec13fByTickerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_ticker_holders").execute({
      ticker: "XYZZZ",
    }),
  ) as { summary: string; item: { holders: unknown[] }; meta: { notice?: string } };

  // Web's notice is the human line; MCP no longer branches on
  // total_holders_in_scope to invent "no holders" prose.
  assert.equal(payload.summary, NOTICE);
  assert.equal(payload.meta.notice, NOTICE);
  assert.equal(payload.item.holders.length, 0);
});

test("sec_13f_list_top_managers returns ranked managers using period_rank field", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async listTop13FManagers(args: Record<string, unknown>) {
      captured.args = args;
      return {
        data: {
          manager_set_period: "2025-12-31",
          ranking_period: "2025-12-31",
          managers: [
            {
              manager_cik: "102909",
              manager_name: "VANGUARD GROUP INC",
              aliases: ["VANGUARD"],
              period_rank: 1,
              period_reportable_value_usd: 5_000_000_000_000,
            },
            {
              manager_cik: "1067983",
              manager_name: "BERKSHIRE HATHAWAY INC",
              aliases: ["BERKSHIRE", "BRK"],
              period_rank: 7,
              period_reportable_value_usd: 302_459_211_458,
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const raw = await harness.get("sec_13f_list_top_managers").execute({
    limit: 30,
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    item: {
      manager_set_period: string | null;
      ranking_period: string | null;
      managers: Array<{ manager_cik: string; period_rank: number }>;
    };
    meta: { creditsUsed: number; remainingCredits: number; notice?: string };
  };

  assert.equal(captured.args?.limit, 30);
  // No notice → guidance line built purely from public data.
  assert.match(payload.summary, /Top 2 institutional managers/);
  assert.match(payload.summary, /VANGUARD GROUP INC/);
  assert.equal(payload.item.manager_set_period, "2025-12-31");
  assert.equal(payload.item.ranking_period, "2025-12-31");
  assert.equal(payload.item.managers[0].manager_cik, "102909");
  assert.equal(payload.item.managers[0].period_rank, 1);
  assert.equal(payload.item.managers[1].period_rank, 7);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal("scope" in payload.meta, false);
  assert.doesNotMatch(raw, /scope_notice|"scope"|available_ranking_periods/);
});

test("sec_13f_list_top_managers forwards (year, quarter) for previous-quarter ranking", async () => {
  const harness = createToolHarness();
  const captured: { args: Record<string, unknown> | null } = { args: null };
  const api = {
    async listTop13FManagers(args: Record<string, unknown>) {
      captured.args = args;
      return {
        data: {
          manager_set_period: "2025-12-31",
          ranking_period: "2025-09-30",
          managers: [
            {
              manager_cik: "102909",
              manager_name: "VANGUARD GROUP INC",
              aliases: ["VANGUARD"],
              period_rank: 1,
              period_reportable_value_usd: 4_800_000_000_000,
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_top_managers").execute({
      limit: 30,
      year: 2025,
      quarter: 3,
    }),
  ) as {
    summary: string;
    item: { ranking_period: string | null };
  };

  assert.equal(captured.args?.year, 2025);
  assert.equal(captured.args?.quarter, 3);
  assert.equal(payload.item.ranking_period, "2025-09-30");
  assert.match(payload.summary, /2025-09-30/);
});

test("sec_13f_list_top_managers forwards out-of-window notice verbatim", async () => {
  const harness = createToolHarness();
  const NOTICE =
    "No 13F ranking data is available for 2024 Q2. Covered quarters: 2025-03-31 through 2025-12-31.";
  const api = {
    async listTop13FManagers() {
      return {
        data: {
          manager_set_period: "2025-12-31",
          ranking_period: "2024-06-30",
          managers: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          notice: NOTICE,
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_top_managers").execute({
      limit: 30,
      year: 2024,
      quarter: 2,
    }),
  ) as { summary: string; item: { managers: unknown[] }; meta: { notice?: string } };

  // Web's notice is the human line; MCP forwards it instead of building a
  // summary from the (now removed) scope.available_ranking_periods field.
  assert.equal(payload.summary, NOTICE);
  assert.equal(payload.meta.notice, NOTICE);
  assert.equal(payload.item.managers.length, 0);
});

test("sec_13f_list_top_managers falls back to a data-only summary when no notice is sent", async () => {
  const harness = createToolHarness();
  const api = {
    async listTop13FManagers() {
      return {
        data: {
          manager_set_period: null,
          ranking_period: null,
          managers: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const raw = await harness.get("sec_13f_list_top_managers").execute({ limit: 30 });
  const payload = JSON.parse(raw) as { summary: string; meta: { notice?: string } };

  // No notice and no managers → MCP's own minimal data-derived line (no scope).
  assert.match(payload.summary, /No ranked managers available/);
  assert.equal(payload.meta.notice, undefined);
  assert.doesNotMatch(raw, /scope_notice|"scope"|available_ranking_periods/);
});
