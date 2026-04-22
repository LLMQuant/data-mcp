import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

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

const SCOPE = {
  managers_seeded: 1000,
  latest_period: "2025-12-31",
  earliest_period: "2025-03-31",
  selection_basis: "latest quarter 13F reportable value desc",
  is_top_1000_only: true,
};

test("sec_13f_list_manager_holdings returns holdings summary + passes through scope metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getSec13fByManager() {
      return {
        data: {
          manager: {
            manager_cik: "1067983",
            manager_name: "BERKSHIRE HATHAWAY INC",
            match_type: "alias" as const,
            latest_reportable_value_usd: 302_459_211_458,
            latest_reportable_value_period: "2025-12-31",
            current_scope_rank: 7,
            is_in_latest_seed_universe: true,
          },
          filing: {
            sec_13f_filing_id: "filing-uuid",
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
          scope: SCOPE,
          scope_notice: "13F data covers the latest-quarter top 1,000",
        },
      };
    },
  };

  registerSec13fByManagerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_manager_holdings").execute({
      manager_name: "Berkshire",
      period: "2025-12-31",
      limit: 200,
    }),
  ) as {
    summary: string;
    item: {
      manager: { manager_cik: string; is_in_latest_seed_universe: boolean };
      holdings: Array<{ ticker: string | null }>;
    };
    meta: { creditsUsed: number; scope: { managers_seeded: number }; scope_notice: string };
  };

  assert.match(payload.summary, /2025-12-31/);
  assert.match(payload.summary, /1 holdings/);
  assert.equal(payload.item.manager.manager_cik, "1067983");
  assert.equal(payload.item.holdings[0]?.ticker, "AXP");
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.scope.managers_seeded, 1000);
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

test("sec_13f_list_manager_holdings surfaces out-of-scope manager with explicit summary", async () => {
  const harness = createToolHarness();
  const api = {
    async getSec13fByManager() {
      return {
        data: {
          manager: {
            manager_cik: "9999",
            manager_name: "",
            match_type: "cik" as const,
            latest_reportable_value_usd: 0,
            latest_reportable_value_period: null,
            current_scope_rank: null,
            is_in_latest_seed_universe: false,
          },
          filing: null,
          holdings: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          scope: SCOPE,
          scope_notice: "Manager is outside the seeded Top 1000 scope.",
        },
      };
    },
  };

  registerSec13fByManagerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_manager_holdings").execute({
      manager_cik: "9999",
    }),
  ) as { summary: string; item: { holdings: unknown[] } };

  assert.match(payload.summary, /outside the seeded Top 1000 scope/);
  assert.equal(payload.item.holdings.length, 0);
});

test("sec_13f_list_ticker_holders formats holder summary", async () => {
  const harness = createToolHarness();
  const api = {
    async getSec13fByTicker() {
      return {
        data: {
          ticker: "NVDA",
          period_of_report: "2025-12-31",
          total_holders_in_scope: 187,
          aggregate_value_usd: 123_456_789_000,
          holders: [
            {
              manager_cik: "1067983",
              manager_name: "BERKSHIRE HATHAWAY INC",
              manager_reportable_value_usd: 302_459_211_458,
              manager_reportable_value_period: "2025-12-31",
              manager_scope_rank: 7,
              sec_13f_filing_id: "filing-uuid",
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
          scope: SCOPE,
          scope_notice:
            "Holders list is restricted to the latest-quarter top 1,000 managers",
        },
      };
    },
  };

  registerSec13fByTickerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_ticker_holders").execute({
      ticker: "NVDA",
    }),
  ) as {
    summary: string;
    item: { ticker: string; total_holders_in_scope: number };
    meta: { creditsUsed: number; scope_notice: string };
  };

  assert.match(payload.summary, /NVDA 2025-12-31/);
  assert.match(payload.summary, /187 holders/);
  assert.equal(payload.item.ticker, "NVDA");
  assert.equal(payload.item.total_holders_in_scope, 187);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("sec_13f_list_ticker_holders handles no-hit empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getSec13fByTicker() {
      return {
        data: {
          ticker: "XYZZZ",
          period_of_report: "2025-12-31",
          total_holders_in_scope: 0,
          aggregate_value_usd: 0,
          holders: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          scope: SCOPE,
          scope_notice:
            "Holders list is restricted to the latest-quarter top 1,000 managers. No holders found for XYZZZ.",
        },
      };
    },
  };

  registerSec13fByTickerTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_ticker_holders").execute({
      ticker: "XYZZZ",
    }),
  ) as { summary: string; item: { holders: unknown[] } };

  assert.match(payload.summary, /no holders in Top 1000 scope/);
  assert.equal(payload.item.holders.length, 0);
});

test("sec_13f_list_top_managers returns ranked managers with scope metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async listTop13FManagers() {
      return {
        data: {
          managers: [
            {
              manager_cik: "102909",
              manager_name: "VANGUARD GROUP INC",
              aliases: ["VANGUARD"],
              current_scope_rank: 1,
              latest_reportable_value_usd: 5_000_000_000_000,
              latest_reportable_value_period: "2025-12-31",
            },
            {
              manager_cik: "1067983",
              manager_name: "BERKSHIRE HATHAWAY INC",
              aliases: ["BERKSHIRE", "BRK"],
              current_scope_rank: 7,
              latest_reportable_value_usd: 302_459_211_458,
              latest_reportable_value_period: "2025-12-31",
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          scope: SCOPE,
          scope_notice: "13F data covers the latest-quarter top 1,000",
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_top_managers").execute({
      limit: 30,
    }),
  ) as {
    summary: string;
    item: {
      managers: Array<{
        manager_cik: string;
        current_scope_rank: number;
      }>;
    };
    meta: { creditsUsed: number; scope: { latest_period: string } };
  };

  assert.match(payload.summary, /Top 2 smart money managers/);
  assert.match(payload.summary, /VANGUARD GROUP INC/);
  assert.equal(payload.item.managers[0].manager_cik, "102909");
  assert.equal(payload.item.managers[0].current_scope_rank, 1);
  assert.equal(payload.item.managers[1].current_scope_rank, 7);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.scope.latest_period, "2025-12-31");
});

test("sec_13f_list_top_managers surfaces empty scope with explicit summary", async () => {
  const harness = createToolHarness();
  const api = {
    async listTop13FManagers() {
      return {
        data: { managers: [] },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          scope: SCOPE,
          scope_notice:
            "13F data covers the latest-quarter top 1,000. Only the latest ranked quarter (2025-12-31) is stored; 2024-06-30 has no ranking.",
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_top_managers").execute({
      limit: 30,
      period: "2024-06-30",
    }),
  ) as { summary: string; item: { managers: unknown[] } };

  assert.match(payload.summary, /No ranked managers available/);
  assert.equal(payload.item.managers.length, 0);
});

test("sec_13f_list_top_managers avoids exposing 'n/a' when scope.latest_period is null", async () => {
  const harness = createToolHarness();
  const emptyScope = {
    managers_seeded: 0,
    latest_period: null,
    earliest_period: null,
    selection_basis: "latest quarter 13F reportable value desc",
    is_top_1000_only: true,
  };
  const api = {
    async listTop13FManagers() {
      return {
        data: { managers: [] },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          scope: emptyScope,
          scope_notice: "13F data covers the latest-quarter top 1,000 institutional managers.",
        },
      };
    },
  };

  registerSec13fListTopManagersTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_13f_list_top_managers").execute({ limit: 30 }),
  ) as { summary: string };

  assert.doesNotMatch(payload.summary, /n\/a/);
  assert.match(payload.summary, /seed may not have been run/);
});
