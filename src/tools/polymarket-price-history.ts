import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  earliestHasStartTime,
  polymarketIsoDateTimeSchema,
  polymarketOutcomeTokenSchema,
  polymarketPriceIntervalSchema,
  polymarketPriceLimitSchema,
  takeFromSchema,
} from "../shared/schemas";
import { orderedStartEnd } from "./polymarket-shared";

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
      .describe("Inclusive ISO 8601 UTC window start."),
    end_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Inclusive ISO 8601 UTC window end."),
    limit: polymarketPriceLimitSchema
      .optional()
      .describe(
        "Maximum probability points to keep after time filtering. Defaults by interval: 1h=720, 1d=365. Max: 20000.",
      ),
    take_from: takeFromSchema
      .default("latest")
      .describe(
        'Which side of the filtered window to keep when more than limit points match. Default: "latest".',
      ),
  })
  .refine(orderedStartEnd, {
    message: "start_time must not be after end_time.",
  })
  .refine(earliestHasStartTime, {
    message: "take_from=earliest requires start_time.",
  });

export function registerPolymarketPriceHistoryTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_price_history",
    description:
      "Retrieve hourly or daily implied-probability points for one Prediction Markets outcome token by point time. " +
      "Use start_time/end_time to bound the window; single boundaries are allowed. " +
      "limit keeps at most N points, take_from chooses latest or earliest candidates, and results return oldest first. " +
      "Use polymarket_market_read first to find outcome_token_id.",
    parameters,
    execute: async (
      { outcome_token_id, interval, start_time, end_time, limit, take_from },
      context,
    ) => {
      try {
        const effectiveTakeFrom = take_from ?? "latest";
        if (effectiveTakeFrom === "earliest" && !start_time) {
          throw new Error("take_from=earliest requires start_time.");
        }

        const response = await getApiClient(api, context).getPolymarketPriceHistory({
          outcomeTokenId: outcome_token_id,
          interval,
          startTime: start_time,
          endTime: end_time,
          limit,
          takeFrom: effectiveTakeFrom,
        });
        const data = response.data;

        return formatToolResult({
          summary: `${interval} probability history: ${data.points.length} point(s).`,
          data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
