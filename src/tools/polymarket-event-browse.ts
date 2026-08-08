import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  lexicalFilterQuerySchema,
  polymarketBrowseLimitSchema,
  polymarketIsoDateTimeSchema,
  polymarketNonNegativeNumberSchema,
  polymarketStatusSchema,
} from "../shared/schemas";
import { eventCount, orderedStartEnd, pairedStartEnd } from "./polymarket-shared";

const parameters = z
  .object({
    status: polymarketStatusSchema
      .default("active")
      .describe(
        'Event lifecycle filter. Defaults to "active"; pass "inactive" only for audit or recovery workflows.',
      ),
    query: lexicalFilterQuerySchema
      .optional()
      .describe(
        "Optional exact lexical filter across event title, slug, description, tags, child market questions, and outcome labels. Not semantic; use polymarket_event_search for natural-language discovery.",
      ),
    tag: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Optional finance tag filter, e.g. "crypto" or "regulation".'),
    asset: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Optional asset/entity filter, e.g. "BTC", "ETH", or "SPY".'),
    start_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range start. Must be used with end_time."),
    end_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range end. Must be used with start_time."),
    min_volume: polymarketNonNegativeNumberSchema
      .optional()
      .describe("Optional minimum event-level market volume."),
    min_liquidity: polymarketNonNegativeNumberSchema
      .optional()
      .describe("Optional minimum event-level market liquidity."),
    limit: polymarketBrowseLimitSchema
      .default(20)
      .describe("Maximum events to return. Default: 20. Max: 100."),
    cursor: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Opaque pagination token from data.nextCursor."),
  })
  .refine(pairedStartEnd, {
    message: "start_time and end_time must be used together.",
  })
  .refine(orderedStartEnd, {
    message: "start_time must not be after end_time.",
  });

export function registerPolymarketEventBrowseTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_event_browse",
    description:
      "List or exact-filter LLMQuant's finance-scoped Prediction Markets events. " +
      "Use this only when the user asks to list events or provides exact filters/keywords; " +
      "use polymarket_event_search first for natural-language topics, news, policy, asset, or macro-theme discovery. " +
      "This surface covers finance events only and does not support sports, entertainment, wallet, trading, or private user state.",
    parameters,
    execute: async (
      {
        status,
        query,
        tag,
        asset,
        start_time,
        end_time,
        min_volume,
        min_liquidity,
        limit,
        cursor,
      },
      context,
    ) => {
      try {
        const response = await getApiClient(api, context).browsePolymarketEvents({
          status,
          query,
          tag,
          asset,
          startTime: start_time,
          endTime: end_time,
          minVolume: min_volume,
          minLiquidity: min_liquidity,
          limit,
          cursor,
        });
        const count = eventCount(response.data);
        return formatToolResult({
          summary:
            count === 0
              ? "No finance prediction-market events matched the filters."
              : `Found ${count} finance prediction-market event(s).`,
          data: response.data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
