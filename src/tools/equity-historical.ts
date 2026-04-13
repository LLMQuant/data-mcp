import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { equityTickerSchema, equityLimitSchema } from "../shared/schemas";

export function registerEquityHistoricalTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "equity_historical_prices",
    description:
      "Query US equity historical daily OHLCV prices (via Yahoo Finance). Returns closed trading days only. " +
      "Includes adjusted_close, dividend, and stock_split fields. " +
      "Two usage patterns: (1) pass limit for the most recent bars; " +
      "(2) pass start_date + end_date for a specific date range. " +
      "Do not pass start_date without end_date or vice versa.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'US equity ticker (e.g. "AAPL", "MSFT", "BRK.B", "^GSPC" for S&P 500 index).',
      ),
      start_date: z
        .string()
        .optional()
        .describe(
          "Start of date range in YYYY-MM-DD format (e.g. 2025-04-01). Must be used with end_date.",
        ),
      end_date: z
        .string()
        .optional()
        .describe(
          "End of date range in YYYY-MM-DD format. Must be used with start_date.",
        ),
      limit: equityLimitSchema
        .optional()
        .describe(
          "Number of recent trading days (ignored when start_date/end_date are set). " +
          "Default: 30. Max: 200.",
        ),
    }),
    execute: async ({ ticker, start_date, end_date, limit }) => {
      try {
        const response = await api.getEquityHistorical({
          ticker,
          startDate: start_date,
          endDate: end_date,
          limit,
        });

        const summary =
          response.data.prices.length === 0
            ? `No price data found for ${ticker}.`
            : `${ticker} daily prices: ${response.data.prices.length} trading day(s).`;

        return formatToolResult({
          summary,
          item: {
            ticker: response.data.ticker,
            interval: response.data.interval,
            prices: response.data.prices,
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
