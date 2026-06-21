import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  equityIntradayDateSchema,
  equityIntradayIntervalSchema,
  equityIntradayLimitSchema,
  equityTickerSchema,
} from "../shared/schemas";

const MAX_RANGE_DAYS = 14;

export function registerEquityIntradayTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "equity_intraday_prices",
    description:
      "Query US equity 1h intraday OHLCV prices. Returns closed regular-session bars only. " +
      "Two usage patterns: (1) pass limit for the most recent bars; " +
      "(2) pass start_date + end_date for a specific date range. " +
      "Do not combine limit with start_date/end_date.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'US equity ticker (e.g. "AAPL", "MSFT", "BRK.B", "^GSPC" for S&P 500 index).',
      ),
      interval: equityIntradayIntervalSchema
        .optional()
        .describe('Intraday interval. MVP supports only "1h".'),
      start_date: equityIntradayDateSchema
        .optional()
        .describe(
          "Start of date range in YYYY-MM-DD format. Must be used with end_date.",
        ),
      end_date: equityIntradayDateSchema
        .optional()
        .describe(
          "End of date range in YYYY-MM-DD format. Must be used with start_date.",
        ),
      limit: equityIntradayLimitSchema
        .optional()
        .describe(
          "Number of recent 1h bars. Default: 35. Max: 70. Cannot be combined with start_date/end_date.",
        ),
    }),
    execute: async ({ ticker, interval, start_date, end_date, limit }, context) => {
      try {
        const effectiveInterval = interval ?? "1h";
        if (effectiveInterval !== "1h") {
          throw new Error('interval must be "1h".');
        }

        const hasStart = Boolean(start_date);
        const hasEnd = Boolean(end_date);
        if (hasStart !== hasEnd) {
          throw new Error("start_date and end_date must be used together.");
        }

        const isRangeMode = hasStart && hasEnd;
        if (isRangeMode && limit != null) {
          throw new Error(
            "limit cannot be combined with start_date/end_date. Use recent mode or range mode.",
          );
        }

        if (isRangeMode && start_date && end_date) {
          assertRangeWithinLimit(start_date, end_date);
        }

        const response = await getApiClient(api, context).getEquityIntraday({
          ticker,
          interval: "1h",
          startDate: start_date,
          endDate: end_date,
          limit: isRangeMode ? undefined : limit,
        });

        const summary =
          response.data.prices.length === 0
            ? `No 1h intraday price data found for ${ticker}.`
            : `${ticker} 1h intraday prices: ${response.data.prices.length} bar(s).`;

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

function assertRangeWithinLimit(startDate: string, endDate: string) {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  const calendarDays = Math.floor((endMs - startMs) / 86_400_000) + 1;

  if (calendarDays < 1) {
    throw new Error("start_date must not be after end_date.");
  }

  if (calendarDays > MAX_RANGE_DAYS) {
    throw new Error("date range must be 14 calendar days or less.");
  }
}
