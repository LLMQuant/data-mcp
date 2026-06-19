import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { tickerSchema, intervalSchema, cryptoLimitSchema } from "../shared/schemas";

export function registerCryptoHistoricalTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "crypto_historical_klines",
    description:
      "Query historical crypto OHLCV candlestick data. Returns closed candles only. " +
      "Two usage patterns: (1) pass limit for the most recent candles; " +
      "(2) pass start_time + end_time for a specific date range. " +
      "Do not pass start_time without end_time or vice versa.",
    parameters: z.object({
      ticker: tickerSchema.describe(
        'Crypto ticker in BASE-QUOTE format (e.g. "BTC-USD", "ETH-USD").',
      ),
      interval: intervalSchema.describe(
        'Candlestick interval: "1h", "4h", "1d", or "1w".',
      ),
      start_time: z
        .string()
        .optional()
        .describe(
          "Start of date range in ISO 8601 UTC (e.g. 2026-03-01T00:00:00Z). Must be used with end_time.",
        ),
      end_time: z
        .string()
        .optional()
        .describe(
          "End of date range in ISO 8601 UTC. Must be used with start_time.",
        ),
      limit: cryptoLimitSchema
        .optional()
        .describe(
          "Number of recent candles (ignored when start_time/end_time are set). " +
          "Defaults by interval: 1h=24, 4h=42, 1d=30, 1w=12. Max 200.",
        ),
    }),
    execute: async ({ ticker, interval, start_time, end_time, limit }, context) => {
      try {
        // Enforce the description contract: when both start_time and end_time
        // are set, `limit` is ignored. We must not forward the user's limit
        // downstream — that is what caused Issue #280 (silent truncation).
        // See `contexts/mcp/design/tool-expansion.md` §十一.
        const isRangeMode = Boolean(start_time && end_time);
        const effectiveLimit = isRangeMode ? undefined : limit;

        const response = await getApiClient(api, context).getCryptoHistorical({
          ticker,
          interval,
          startTime: start_time,
          endTime: end_time,
          limit: effectiveLimit,
        });

        const summary =
          response.data.prices.length === 0
            ? `No kline data found for ${ticker} (${interval}).`
            : `${ticker} ${interval} klines: ${response.data.prices.length} candle(s).`;

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
