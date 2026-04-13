import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { macroIndicatorSchema, macroLimitSchema } from "../shared/schemas";

export function registerMacroIndicatorHistoryTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "macro_indicator_history",
    description:
      "Retrieve historical observations for a U.S. macro indicator. Returns latest-vintage time series. " +
      "Two patterns: (1) pass limit for most recent N observations; (2) pass start_date + end_date for a range. " +
      "Common indicators: us.cpi.headline, us.cpi.core, us.pce.core, us.unemployment_rate, us.nonfarm_payrolls, " +
      "us.rates.fed_funds, us.yield.10y, us.yield.2y, us.yield_curve.10y_2y, us.gdp.real, us.housing_starts, " +
      "us.money_supply.m2, us.oil.wti_spot, us.consumer_sentiment.umich. " +
      "Use macro_indicator_search first if unsure which indicator to query.",
    parameters: z.object({
      indicator: macroIndicatorSchema
        .optional()
        .describe(
          'Indicator alias (e.g. "us.cpi.headline", "us.rates.fed_funds"). Use this OR series_id.',
        ),
      series_id: z
        .string()
        .optional()
        .describe(
          'FRED series ID (e.g. "CPIAUCSL"). Use this OR indicator. Must be in the allowlist.',
        ),
      start_date: z
        .string()
        .optional()
        .describe(
          "Start of date range in YYYY-MM-DD format. Must be used with end_date.",
        ),
      end_date: z
        .string()
        .optional()
        .describe(
          "End of date range in YYYY-MM-DD format. Must be used with start_date.",
        ),
      limit: macroLimitSchema
        .optional()
        .describe(
          "Number of recent observations (ignored when start_date/end_date are set). " +
          "Default: 60. Max: 500.",
        ),
    }),
    execute: async ({ indicator, series_id, start_date, end_date, limit }) => {
      try {
        const response = await api.getMacroHistorical({
          indicator,
          seriesId: series_id,
          startDate: start_date,
          endDate: end_date,
          limit,
        });

        const id = response.data.indicator || response.data.seriesId;
        const summary =
          response.data.observations.length === 0
            ? `No observations found for ${id}.`
            : `${id} (${response.data.frequency}): ${response.data.observations.length} observation(s).`;

        return formatToolResult({
          summary,
          item: {
            indicator: response.data.indicator,
            seriesId: response.data.seriesId,
            frequency: response.data.units ? `${response.data.frequency} (${response.data.units})` : response.data.frequency,
            observations: response.data.observations,
          },
          meta: {
            count: response.meta.count,
            creditsUsed: response.meta.creditsUsed,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
