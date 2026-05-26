import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fByTickerLimitSchema,
  sec13fTickerSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fByTickerTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_13f_list_ticker_holders",
    description:
      "List institutional managers from the SEC Form 13F Top 1000 universe " +
      "that hold a given U.S. ticker in a given quarter. Returns a ranked " +
      "holders list (sorted by value_usd desc).\n\n" +
      "Inputs: `ticker` required (case-insensitive; server normalizes `BRK.B` " +
      "→ `BRK-B`); optional `year` + `quarter` paired (defaults to the " +
      "universe quarter); optional `limit` (default 100, max 1000).\n\n" +
      "Returns: data.ticker (normalized), data.ranking_period, data.total_" +
      "holders_in_scope, data.aggregate_value_usd, data.holders[] with each " +
      "entry carrying manager_cik, manager_name, manager_period_rank, " +
      "manager_period_reportable_value_usd, manager_period_of_report, position " +
      "fields (cusip, title_of_class, value_usd, shares, shares_type, " +
      "sec_13f_filing_id, accession_number).\n\n" +
      "Coverage: limited to the Top 1000 smart-money universe — this is NOT " +
      "the full set of 13F filers holding the ticker. Available quarters listed " +
      "in meta.scope.available_ranking_periods; outside that returns empty " +
      "holders + scope_notice. Reportable value is an AUM proxy (excludes " +
      "fixed income, options, non-U.S. holdings, shorts).\n\n" +
      "Not a semantic search. Not a quarter-diff / aggregated ranking endpoint " +
      "— returns raw holder rows only.",
    parameters: z
      .object({
        ticker: sec13fTickerSchema.describe(
          'U.S. equity ticker (e.g. "NVDA", "TSLA", "AAPL"); server normalizes "BRK.B" to "BRK-B".',
        ),
        year: secYearSchema
          .optional()
          .describe(
            "Calendar year of the quarter to query (e.g. 2025). Required together with quarter. Omit both for latest covered quarter. 13F data coverage starts in 2013; out-of-coverage years return a validation error.",
          ),
        quarter: secQuarterSchema
          .optional()
          .describe(
            "Calendar quarter 1-4 (Q1=Jan-Mar, Q4=Oct-Dec). Required together with year.",
          ),
        limit: sec13fByTickerLimitSchema
          .optional()
          .describe("Max holders to return. Default: 100. Max: 1000."),
      })
      .refine(
        (val) => (val.year === undefined) === (val.quarter === undefined),
        { message: "year and quarter must be provided together." },
      ),
    execute: async ({ ticker, year, quarter, limit }, context) => {
      try {
        const response = await getApiClient(api, context).getSec13fByTicker({
          ticker,
          year,
          quarter,
          limit,
        });

        const {
          ticker: normalizedTicker,
          ranking_period,
          total_holders_in_scope,
          aggregate_value_usd,
        } = response.data;
        const summary = total_holders_in_scope === 0
          ? `${normalizedTicker} ${ranking_period ?? "(no period)"}: no holders in Top 1000 scope.`
          : `${normalizedTicker} ${ranking_period ?? ""} — ${formatNumber(total_holders_in_scope)} holders in Top 1000, aggregate reportable value $${formatNumber(Math.round(aggregate_value_usd))}`;

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
