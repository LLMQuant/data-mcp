import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { polymarketCardIdSchema } from "../shared/schemas";

export function registerPolymarketEventReadTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_event_read",
    description:
      "Read one normalized Prediction Markets event card by LLMQuant event_card_id, including child market previews. Use polymarket_event_search first for natural-language discovery; use polymarket_event_browse only for list/exact-filter workflows.",
    parameters: z.object({
      event_card_id: polymarketCardIdSchema.describe(
        'LLMQuant event card id from a search or browse result, e.g. "pme_902959".',
      ),
    }),
    execute: async ({ event_card_id }, context) => {
      try {
        const response = await getApiClient(api, context).readPolymarketEvent({
          eventCardId: event_card_id,
        });
        const data = response.data;
        const marketCount =
          typeof data.marketCount === "number" ? data.marketCount : data.markets.length;

        return formatToolResult({
          summary: `Loaded Prediction Markets event "${data.title}" with ${marketCount} market(s).`,
          data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
