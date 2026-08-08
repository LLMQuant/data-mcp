import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  dateSchema,
  earliestHasStartDate,
  macroIndicatorSchema,
  macroLimitSchema,
  orderedDateRange,
  takeFromSchema,
} from "../shared/schemas";

export function registerMacroIndicatorHistoryTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "macro_indicator_history",
    description:
      "Retrieve latest-vintage observations for a U.S. macro indicator by observation date. " +
      "Use start_date/end_date to bound the window; single boundaries are allowed. " +
      "limit keeps at most N observations, take_from chooses latest or earliest candidates, and results return oldest first. " +
      "Use macro_indicator_search first if you need to find an indicator.",
    parameters: z
      .object({
        indicator: macroIndicatorSchema
          .optional()
          .describe(
            'Indicator alias (e.g. "us.cpi.headline", "us.rates.fed_funds"). Use this OR series_id.',
          ),
        series_id: z
          .string()
          .optional()
          .describe(
            'FRED series ID (e.g. "CPIAUCSL"). Use this OR indicator. Must be in the supported catalog.',
          ),
        start_date: dateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD observation-date window start.",
          ),
        end_date: dateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD observation-date window end.",
          ),
        limit: macroLimitSchema
          .optional()
          .describe(
            "Maximum observations to keep after date filtering. " +
            "Default: 60. Max: 500.",
          ),
        take_from: takeFromSchema
          .default("latest")
          .describe(
            'Which side of the filtered window to keep when more than limit observations match. Default: "latest".',
          ),
      })
      .refine(orderedDateRange, {
        message: "start_date must not be after end_date.",
      })
      .refine(earliestHasStartDate, {
        message: "take_from=earliest requires start_date.",
      }),
    execute: async (
      { indicator, series_id, start_date, end_date, limit, take_from },
      context,
    ) => {
      try {
        const effectiveTakeFrom = take_from ?? "latest";
        assertHistoricalWindow({
          start: start_date,
          end: end_date,
          takeFrom: effectiveTakeFrom,
          startName: "start_date",
          endName: "end_date",
        });

        const response = await getApiClient(api, context).getMacroHistorical({
          indicator,
          seriesId: series_id,
          startDate: start_date,
          endDate: end_date,
          limit,
          takeFrom: effectiveTakeFrom,
        });

        const id = response.data.indicator || response.data.seriesId;
        const summary =
          response.data.observations.length === 0
            ? `No observations found for ${id}.`
            : `${id} (${response.data.frequency}): ${response.data.observations.length} observation(s).`;

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

function assertHistoricalWindow({
  start,
  end,
  takeFrom,
  startName,
  endName,
}: {
  start?: string;
  end?: string;
  takeFrom: "latest" | "earliest";
  startName: string;
  endName: string;
}) {
  if (takeFrom === "earliest" && !start) {
    throw new Error(`take_from=earliest requires ${startName}.`);
  }

  if (start && end && Date.parse(`${start}T00:00:00Z`) > Date.parse(`${end}T00:00:00Z`)) {
    throw new Error(`${startName} must not be after ${endName}.`);
  }
}
