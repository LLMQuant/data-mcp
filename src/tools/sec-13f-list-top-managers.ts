import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  sec13fPeriodSchema,
  sec13fTopManagersLimitSchema,
} from "../shared/schemas";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function registerSec13fListTopManagersTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "sec_13f_list_top_managers",
    description:
      "List the top N institutional managers from the latest-quarter SEC Form 13F " +
      "smart money universe (up to top 1,000), ranked by 13F reportable value " +
      "descending. Returns { manager_cik, manager_name, aliases, current_scope_rank, " +
      "latest_reportable_value_usd, latest_reportable_value_period } per entry, " +
      "ordered by current_scope_rank ascending (rank 1 = largest).\n\n" +
      "INTENDED USE: call this first to derive a fund pool (e.g. top 30) for " +
      "consensus-holdings / smart-money-aggregate analyses, then call " +
      "sec_13f_list_manager_holdings once per manager to fan out into holdings.\n\n" +
      "COVERAGE SCOPE: only the latest seeded quarter carries a ranking. " +
      "reportable value is an AUM proxy, not true firmwide AUM — it excludes " +
      "fixed income, options, non-U.S. holdings, and shorts.\n\n" +
      "This is NOT a semantic search tool. It is parameterized ranked lookup: " +
      "limit + optional period (YYYY-MM-DD quarter-end). If period differs from " +
      "the latest seeded ranking quarter, the response is empty with a scope_notice " +
      "— historical rankings are NOT stored. Do not expect quarter-over-quarter " +
      "ranking diffs from this tool.",
    parameters: z.object({
      limit: sec13fTopManagersLimitSchema
        .optional()
        .describe(
          "Max managers to return, ordered by rank ascending (rank 1 = largest). Default: 30. Max: 1000.",
        ),
      period: sec13fPeriodSchema
        .optional()
        .describe(
          'Quarter-end date "YYYY-MM-DD" (e.g. "2025-12-31"). Defaults to the latest seeded ranking quarter; other periods return an empty list with scope_notice.',
        ),
    }),
    execute: async ({ limit, period }) => {
      try {
        const response = await api.listTop13FManagers({
          limit: limit ?? 30,
          period,
        });

        const { managers } = response.data;
        const { scope } = response.meta;
        const rankedPeriod = scope.latest_period;

        let summary: string;
        if (managers.length === 0) {
          summary = rankedPeriod
            ? `No ranked managers available for ${period ?? rankedPeriod}. Only the latest seeded ranking quarter (${rankedPeriod}) is stored.`
            : "No 13F manager ranking available yet — the seed may not have been run.";
        } else {
          const periodLabel = rankedPeriod ?? "latest seeded quarter";
          const rank1 = managers[0].manager_name || managers[0].manager_cik;
          summary = `Top ${formatNumber(managers.length)} smart money managers for ${periodLabel} (rank 1 = ${rank1})`;
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
