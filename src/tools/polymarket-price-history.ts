import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  polymarketIsoDateTimeSchema,
  polymarketOutcomeTokenSchema,
  polymarketPriceIntervalSchema,
  polymarketPriceLimitSchema,
} from "../shared/schemas";
import { orderedStartEnd, pairedStartEnd } from "./polymarket-shared";

const parameters = z
  .object({
    outcome_token_id: polymarketOutcomeTokenSchema.describe(
      "Outcome token id from polymarket_market_read. This identifies one outcome side, not the market id.",
    ),
    interval: polymarketPriceIntervalSchema.describe(
      'Price-history interval. Supported values: "1h" and "1d".',
    ),
    start_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range start. Must be used with end_time."),
    end_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range end. Must be used with start_time."),
    limit: polymarketPriceLimitSchema
      .optional()
      .describe("Optional maximum probability points to return. Max: 20000."),
  })
  .refine(pairedStartEnd, {
    message: "start_time and end_time must be used together.",
  })
  .refine(orderedStartEnd, {
    message: "start_time must not be after end_time.",
  });

export function registerPolymarketPriceHistoryTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_price_history",
    description:
      "Retrieve hourly or daily implied-probability points for one Prediction Markets outcome token. Returns probability points, not OHLCV candles, order book data, or trading-grade quotes.",
    parameters,
    execute: async (
      { outcome_token_id, interval, start_time, end_time, limit },
      context,
    ) => {
      try {
        const response = await getApiClient(api, context).getPolymarketPriceHistory({
          outcomeTokenId: outcome_token_id,
          interval,
          startTime: start_time,
          endTime: end_time,
          limit,
        });
        const item = response.data;

        return formatToolResult({
          summary: `${interval} probability history: ${item.points.length} point(s) (${item.coverageStatus}).`,
          data: item,
          item,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
