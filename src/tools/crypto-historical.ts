import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  cryptoLimitSchema,
  earliestHasStartTime,
  intervalSchema,
  isoUtcDateTimeSchema,
  orderedTimeRange,
  takeFromSchema,
  tickerSchema,
} from "../shared/schemas";

export function registerCryptoHistoricalTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "crypto_historical_klines",
    description:
      "Query historical crypto OHLCV candles by candle close time. " +
      "Use start_time/end_time to bound the window; single boundaries are allowed. " +
      "limit keeps at most N candles, take_from chooses latest or earliest candidates, and results return oldest first. " +
      "Use crypto_snapshot for the current market snapshot.",
    parameters: z
      .object({
        ticker: tickerSchema.describe(
          'Crypto ticker in BASE-QUOTE format (e.g. "BTC-USD", "ETH-USD").',
        ),
        interval: intervalSchema.describe(
          'Candlestick interval: "1h", "4h", "1d", or "1w".',
        ),
        start_time: isoUtcDateTimeSchema
          .optional()
          .describe(
            "Inclusive ISO 8601 UTC window start (e.g. 2026-03-01T00:00:00Z).",
          ),
        end_time: isoUtcDateTimeSchema
          .optional()
          .describe(
            "Inclusive ISO 8601 UTC window end.",
          ),
        limit: cryptoLimitSchema
          .optional()
          .describe(
            "Maximum candles to keep after time filtering. " +
            "Defaults by interval: 1h=24, 4h=42, 1d=30, 1w=12. Max 200.",
          ),
        take_from: takeFromSchema
          .default("latest")
          .describe(
            'Which side of the filtered window to keep when more than limit candles match. Default: "latest".',
          ),
      })
      .refine(orderedTimeRange, {
        message: "start_time must not be after end_time.",
      })
      .refine(earliestHasStartTime, {
        message: "take_from=earliest requires start_time.",
      }),
    execute: async (
      { ticker, interval, start_time, end_time, limit, take_from },
      context,
    ) => {
      try {
        const effectiveTakeFrom = take_from ?? "latest";
        assertHistoricalWindow({
          start: start_time,
          end: end_time,
          takeFrom: effectiveTakeFrom,
          startName: "start_time",
          endName: "end_time",
        });

        const response = await getApiClient(api, context).getCryptoHistorical({
          ticker,
          interval,
          startTime: start_time,
          endTime: end_time,
          limit,
          takeFrom: effectiveTakeFrom,
        });

        const summary =
          response.data.prices.length === 0
            ? `No kline data found for ${ticker} (${interval}).`
            : `${ticker} ${interval} klines: ${response.data.prices.length} candle(s).`;

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

  if (start && end && Date.parse(start) > Date.parse(end)) {
    throw new Error(`${startName} must not be after ${endName}.`);
  }
}
