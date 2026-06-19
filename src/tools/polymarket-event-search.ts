import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  polymarketIsoDateTimeSchema,
  polymarketSearchLimitSchema,
  polymarketStatusSchema,
  searchQuerySchema,
} from "../shared/schemas";
import { eventCount, orderedStartEnd, pairedStartEnd } from "./polymarket-shared";

const parameters = z
  .object({
    query: searchQuerySchema.describe(
      "Natural-language search query. Use news, policy, asset, or macro-theme language. Max 2000 characters.",
    ),
    status: polymarketStatusSchema
      .default("active_or_recently_closed")
      .describe('Event lifecycle filter. Defaults to "active_or_recently_closed".'),
    tag: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe('Optional finance tag filter, e.g. "crypto" or "regulation".'),
    start_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range start. Must be used with end_time."),
    end_time: polymarketIsoDateTimeSchema
      .optional()
      .describe("Optional ISO 8601 UTC range end. Must be used with start_time."),
    limit: polymarketSearchLimitSchema
      .default(5)
      .describe("Maximum events to return. Default: 5. Max: 20."),
  })
  .refine(pairedStartEnd, {
    message: "start_time and end_time must be used together.",
  })
  .refine(orderedStartEnd, {
    message: "start_time must not be after end_time.",
  });

export function registerPolymarketEventSearchTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_event_search",
    description:
      "Search finance-scoped Prediction Markets events semantically. Use this when a user asks which prediction markets relate to a news item, policy decision, asset, or macro theme; then read the selected event before drilling into markets.",
    parameters,
    execute: async (
      { query, status, tag, start_time, end_time, limit },
      context,
    ) => {
      try {
        const response = await getApiClient(api, context).searchPolymarketEvents({
          query,
          status,
          tag,
          startTime: start_time,
          endTime: end_time,
          limit,
        });
        const count = eventCount(response.data);
        return formatToolResult({
          summary:
            count === 0
              ? `No finance prediction-market events found for "${query}".`
              : `Found ${count} finance prediction-market event(s) for "${query}".`,
          data: response.data,
          items: response.data.events,
          meta: {
            ...response.meta,
            query,
            limit,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
