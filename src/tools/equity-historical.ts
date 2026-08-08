import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  dateSchema,
  earliestHasStartDate,
  equityLimitSchema,
  equityTickerSchema,
  orderedDateRange,
  takeFromSchema,
} from "../shared/schemas";

export function registerEquityHistoricalTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "equity_historical_prices",
    description:
      "Query US equity daily OHLCV prices by trading date. " +
      "Use start_date/end_date to bound the window; single boundaries are allowed. " +
      "limit keeps at most N trading days, take_from chooses latest or earliest candidates, and results return oldest first.",
    parameters: z
      .object({
        ticker: equityTickerSchema.describe(
          'US equity ticker (e.g. "AAPL", "MSFT", "BRK.B", "^GSPC" for S&P 500 index).',
        ),
        start_date: dateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD window start (e.g. 2025-04-01).",
          ),
        end_date: dateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD window end.",
          ),
        limit: equityLimitSchema
          .optional()
          .describe(
            "Maximum trading days to keep after date filtering. " +
            "Default: 30. Max: 200.",
          ),
        take_from: takeFromSchema
          .default("latest")
          .describe(
            'Which side of the filtered window to keep when more than limit trading days match. Default: "latest".',
          ),
      })
      .refine(orderedDateRange, {
        message: "start_date must not be after end_date.",
      })
      .refine(earliestHasStartDate, {
        message: "take_from=earliest requires start_date.",
      }),
    execute: async ({ ticker, start_date, end_date, limit, take_from }, context) => {
      try {
        const effectiveTakeFrom = take_from ?? "latest";
        assertHistoricalWindow({
          start: start_date,
          end: end_date,
          takeFrom: effectiveTakeFrom,
          startName: "start_date",
          endName: "end_date",
        });

        const response = await getApiClient(api, context).getEquityHistorical({
          ticker,
          startDate: start_date,
          endDate: end_date,
          limit,
          takeFrom: effectiveTakeFrom,
        });

        const summary =
          response.data.prices.length === 0
            ? `No price data found for ${ticker}.`
            : `${ticker} daily prices: ${response.data.prices.length} trading day(s).`;

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
