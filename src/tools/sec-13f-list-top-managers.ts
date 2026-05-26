import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fTopManagersLimitSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fListTopManagersTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_13f_list_top_managers",
    description:
      "List the top N institutional managers from the SEC Form 13F Top 1000 " +
      "universe for a given quarter, sorted by that quarter's 13F reportable " +
      "value descending (rank 1 = largest).\n\n" +
      "Inputs: optional `limit` (default 30, max 1000); optional `year` + " +
      "`quarter` paired (must both be set or both omitted; defaults to the " +
      "universe quarter).\n\n" +
      "Returns per entry: manager_cik, manager_name, aliases, period_rank, " +
      "period_reportable_value_usd. Top-level: data.universe_period (the quarter " +
      "that picked the Top 1000 set; fixed to most recent covered quarter) and " +
      "data.ranking_period (the quarter the response's ranks/values come from; " +
      "equals your input or the universe quarter).\n\n" +
      "Coverage: ranking data is stored for the quarters listed in " +
      "meta.scope.available_ranking_periods (at least the last 4 covered " +
      "quarters; see that field for the actual list); a year/quarter outside " +
      "that list returns empty managers with an explanatory scope_notice. " +
      "Reportable value is an AUM proxy (excludes fixed income, options, " +
      "non-U.S. holdings, shorts), not true firmwide AUM.\n\n" +
      "Not a semantic search. Not a free-text manager filter. Parameterized " +
      "ranked lookup only.",
    parameters: z
      .object({
        limit: sec13fTopManagersLimitSchema
          .optional()
          .describe(
            "Max managers to return, ordered by period_rank ascending (rank 1 = largest). Default: 30. Max: 1000.",
          ),
        year: secYearSchema
          .optional()
          .describe(
            "Calendar year of the quarter to rank (e.g. 2025). Required together with quarter. Omit both for latest covered quarter. 13F data coverage starts in 2013; out-of-coverage years return a validation error.",
          ),
        quarter: secQuarterSchema
          .optional()
          .describe(
            "Calendar quarter 1-4 (Q1=Jan-Mar, Q4=Oct-Dec). Required together with year.",
          ),
      })
      .refine(
        (val) => (val.year === undefined) === (val.quarter === undefined),
        { message: "year and quarter must be provided together." },
      ),
    execute: async ({ limit, year, quarter }, context) => {
      try {
        const response = await getApiClient(api, context).listTop13FManagers({
          limit: limit ?? 30,
          year,
          quarter,
        });

        const { managers, ranking_period: rankingPeriod, universe_period } =
          response.data;

        let summary: string;
        if (managers.length === 0) {
          const requested =
            year !== undefined && quarter !== undefined
              ? `${year} Q${quarter}`
              : "the requested quarter";
          summary = `No ranked managers available for ${requested}. Universe is locked to ${universe_period ?? "latest covered quarter"}; available ranking quarters: ${response.meta.scope.available_ranking_periods.join(", ") || "none covered yet"}.`;
        } else {
          const rank1 = managers[0].manager_name || managers[0].manager_cik;
          summary = `Top ${formatNumber(managers.length)} smart money managers for ${rankingPeriod ?? "latest"} (rank 1 = ${rank1}); universe selected from ${universe_period ?? "latest covered quarter"}.`;
        }

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
