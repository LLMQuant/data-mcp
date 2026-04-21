import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fByManagerLimitSchema,
  sec13fManagerCikSchema,
  sec13fManagerNameSchema,
  sec13fPeriodSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fByManagerTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "sec_13f_list_manager_holdings",
    description:
      "List all SEC Form 13F-HR holdings of a specific institutional manager for a " +
      "given quarter. Returns structured holdings data (CUSIP, ticker, shares, value, " +
      "voting authority) for one manager + one period_of_report. This is the \"show me " +
      "what this fund is holding\" direction.\n\n" +
      "COVERAGE SCOPE: This data is limited to the latest-quarter top 1,000 " +
      "institutional managers ranked by 13F reportable value for the last 4 quarters. " +
      "That reportable value is an AUM proxy, not true firmwide AUM, and excludes " +
      "fixed income, options, non-U.S. holdings, and shorts.\n\n" +
      "This is NOT a semantic search tool. It accepts manager_cik or manager_name. " +
      "When manager_name is provided, the server uses a lightweight internal resolver " +
      "(exact -> alias -> light fuzzy). Ambiguous names return candidates via a 409 " +
      "response; unmatched names return 404 not_found.\n\n" +
      "This tool does NOT compute quarter-over-quarter diffs, new positions, or " +
      "aggregated rankings. To compare quarters, call this tool twice with different " +
      "period values and diff the results on the client side.",
    parameters: z.object({
      manager_cik: sec13fManagerCikSchema
        .optional()
        .describe(
          'SEC CIK of the filing manager (e.g. "1067983" for Berkshire Hathaway). Either manager_cik or manager_name must be provided.',
        ),
      manager_name: sec13fManagerNameSchema
        .optional()
        .describe(
          'Natural-language manager name (e.g. "Berkshire", "Bridgewater"). Resolved server-side via exact -> alias -> light fuzzy; ambiguous names return candidates.',
        ),
      period: sec13fPeriodSchema
        .optional()
        .describe(
          'Quarter-end date "YYYY-MM-DD" (e.g. "2025-12-31"). Defaults to the latest seeded quarter for the resolved manager.',
        ),
      limit: sec13fByManagerLimitSchema
        .optional()
        .describe("Max holdings to return. Default: 200. Max: 500."),
    }),
    execute: async ({ manager_cik, manager_name, period, limit }) => {
      if (!manager_cik && !manager_name) {
        throw new Error(
          "At least one of manager_cik or manager_name must be provided.",
        );
      }
      try {
        const response = await api.getSec13fByManager({
          managerCik: manager_cik,
          managerName: manager_name,
          period,
          limit,
        });

        const { manager, filing, holdings } = response.data;
        const summary = filing
          ? `${manager?.manager_name ?? manager?.manager_cik ?? "manager"} ${filing.period_of_report}: ${formatNumber(holdings.length)} holdings, reportable value $${formatNumber(Math.round(Number(filing.table_value_total ?? 0)))}`
          : manager && !manager.is_in_latest_seed_universe
            ? `Manager ${manager.manager_cik} is outside the seeded Top 1000 scope.`
            : "No 13F filings available for this manager/period.";

        return formatToolResult({
          summary,
          item: response.data,
          meta: {
            creditsUsed: response.meta.creditsUsed,
            scope: response.meta.scope,
            scope_notice: response.meta.scope_notice,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
