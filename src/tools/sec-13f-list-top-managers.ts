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
      "List the top N institutional managers from the SEC Form 13F Top 1,000 " +
      "manager set for a given quarter, sorted by that quarter's 13F reportable " +
      "value descending (rank 1 = largest).\n\n" +
      "Inputs: optional `limit` (default 30, max 1000); optional `year` + " +
      "`quarter` paired (must both be set or both omitted; defaults to the " +
      "manager-set quarter).\n\n" +
      "Returns per entry: manager_cik, manager_name, aliases, period_rank, " +
      "period_reportable_value_usd. Top-level: data.manager_set_period (the quarter " +
      "whose Top 1,000 this response covers) and data.ranking_period (the quarter the " +
      "ranks/values come from). Each quarter returns that quarter's own Top 1,000, so " +
      "data.manager_set_period equals data.ranking_period — both are the quarter you " +
      "query (or the latest covered quarter when you omit year/quarter). Query a " +
      "different quarter to get that quarter's own roster; rosters change across " +
      "quarters as managers move in and out, and an older quarter's roster stays " +
      "stable when a newer quarter is released.\n\n" +
      "Coverage: ranking data is stored for at least the last 4 covered " +
      "quarters; a year/quarter outside that window returns empty managers " +
      "with an explanatory notice. " +
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

        const { managers, ranking_period: rankingPeriod, manager_set_period: managerSetPeriod } =
          response.data;

        // Pure forwarder: surface Web's `meta.notice` (e.g. "no ranking data
        // for that quarter") verbatim when present; otherwise build a guidance
        // line purely from the public `data` payload. Web owns all such phrasing.
        let summary: string;
        if (response.meta.notice) {
          summary = response.meta.notice;
        } else if (managers.length === 0) {
          const requested =
            year !== undefined && quarter !== undefined
              ? `${year} Q${quarter}`
              : "the requested quarter";
          summary = `No ranked managers available for ${requested}.`;
        } else {
          const rank1 = managers[0].manager_name || managers[0].manager_cik;
          summary = `Top ${formatNumber(managers.length)} institutional managers for ${rankingPeriod ?? "latest"} (rank 1 = ${rank1}); manager set selected from ${managerSetPeriod ?? "latest covered quarter"}.`;
        }

        return formatToolResult({
          summary,
          data: response.data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
