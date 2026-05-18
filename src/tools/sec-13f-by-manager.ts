import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fByManagerLimitSchema,
  sec13fManagerCikSchema,
  sec13fManagerNameSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fByManagerTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_13f_list_manager_holdings",
    description:
      "List all SEC Form 13F-HR holdings of a specific institutional manager " +
      "for a given quarter. Returns structured holdings data (CUSIP, ticker, " +
      "shares, value_usd, voting authority, put_call) for one manager + one " +
      "quarter.\n\n" +
      "Inputs: `manager_cik` or `manager_name` (one required); optional `year` " +
      "+ `quarter` paired (defaults to manager's most recent covered quarter); " +
      "optional `limit` (default 200, max 500).\n\n" +
      "Returns: manager identity block (manager_cik, manager_name, match_type, " +
      "latest_reportable_value_usd, latest_reportable_value_period, period_rank, " +
      "period_reportable_value_usd, is_in_latest_seed_universe); filing metadata " +
      "(filing_type, accession_number, filed_at, period_of_report, is_amendment, " +
      "table_entry_total, table_value_total); holdings array sorted by value_usd " +
      "desc. Top-level: data.ranking_period.\n\n" +
      "Manager-name resolver semantics: 0 candidates → 404 manager_not_found; " +
      "multiple candidates → 409 manager_name_ambiguous with candidates[]; " +
      "single match → auto-resolved.\n\n" +
      "Coverage: limited to the Top 1000 smart-money universe; ranking data " +
      "stored for the quarters listed in meta.scope.available_ranking_periods. " +
      "Out-of-scope manager_cik returns 200 + empty data + scope_notice. " +
      "Reportable value is an AUM proxy (excludes fixed income, options, " +
      "non-U.S. holdings, shorts).\n\n" +
      "Not a semantic search. Not a quarter-diff / new-position / aggregated " +
      "ranking endpoint — returns raw holdings only.",
    parameters: z
      .object({
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
        year: secYearSchema
          .optional()
          .describe(
            "Calendar year of the quarter to query (e.g. 2025). Required together with quarter. Omit both for the manager's latest covered quarter. NOTE: schema accepts 1900-2100 to share with 10-K/10-Q tools, but 13F data coverage starts in 2013; out-of-coverage years return 400 from the web layer.",
          ),
        quarter: secQuarterSchema
          .optional()
          .describe(
            "Calendar quarter 1-4 (Q1=Jan-Mar, Q4=Oct-Dec). Required together with year.",
          ),
        limit: sec13fByManagerLimitSchema
          .optional()
          .describe("Max holdings to return. Default: 200. Max: 500."),
      })
      .refine(
        (val) => (val.year === undefined) === (val.quarter === undefined),
        { message: "year and quarter must be provided together." },
      ),
    execute: async ({ manager_cik, manager_name, year, quarter, limit }, context) => {
      if (!manager_cik && !manager_name) {
        throw new Error(
          "At least one of manager_cik or manager_name must be provided.",
        );
      }
      try {
        const response = await getApiClient(api, context).getSec13fByManager({
          managerCik: manager_cik,
          managerName: manager_name,
          year,
          quarter,
          limit,
        });

        const { manager, filing, holdings } = response.data;
        const summary = filing
          ? `${manager?.manager_name ?? manager?.manager_cik ?? "manager"} ${filing.period_of_report}: ${formatNumber(holdings.length)} holdings, reportable value $${formatNumber(Math.round(Number(filing.table_value_total ?? 0)))}`
          : manager && !manager.is_in_latest_seed_universe
            ? `Manager ${manager.manager_cik} is outside the covered Top 1,000 scope.`
            : "No 13F filings available for this manager/quarter.";

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
