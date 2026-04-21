import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fByTickerLimitSchema,
  sec13fPeriodSchema,
  sec13fTickerSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fByTickerTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "sec_13f_list_ticker_holders",
    description:
      "List institutional managers (from the top 1,000 smart money universe) that " +
      "hold a given U.S. ticker for a given quarter. Returns a ranked list of " +
      "holders with position size plus manager-level reportable value / scope rank, " +
      "so the caller can derive a top-N-by-AUM-proxy fund pool client-side.\n\n" +
      "COVERAGE SCOPE: This data is limited to the latest-quarter top 1,000 " +
      "institutional managers ranked by 13F reportable value. The returned list is " +
      "NOT the full set of 13F filers holding the ticker.\n\n" +
      "This is NOT a semantic search tool. It performs parameterized lookup by " +
      "(ticker, period) and returns exact holder rows. It does not compute quarter " +
      "diffs or aggregated rankings.",
    parameters: z.object({
      ticker: sec13fTickerSchema.describe(
        'U.S. equity ticker (e.g. "NVDA", "TSLA", "AAPL"); server normalizes "BRK.B" to "BRK-B".',
      ),
      period: sec13fPeriodSchema
        .optional()
        .describe(
          'Quarter-end date "YYYY-MM-DD" (e.g. "2025-12-31"). Defaults to the latest seeded quarter.',
        ),
      limit: sec13fByTickerLimitSchema
        .optional()
        .describe("Max holders to return. Default: 100. Max: 1000."),
    }),
    execute: async ({ ticker, period, limit }) => {
      try {
        const response = await api.getSec13fByTicker({ ticker, period, limit });

        const { ticker: normalizedTicker, period_of_report, total_holders_in_scope, aggregate_value_usd } =
          response.data;
        const summary = total_holders_in_scope === 0
          ? `${normalizedTicker} ${period_of_report}: no holders in Top 1000 scope.`
          : `${normalizedTicker} ${period_of_report} — ${formatNumber(total_holders_in_scope)} holders in Top 1000, aggregate reportable value $${formatNumber(Math.round(aggregate_value_usd))}`;

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
