import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { polymarketCardIdSchema } from "../shared/schemas";

export function registerPolymarketMarketReadTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "polymarket_market_read",
    description:
      "Read one Prediction Markets market card by LLMQuant market_card_id after an event has been selected. Returns outcomes, outcome token ids, status, and market metadata.",
    parameters: z.object({
      market_card_id: polymarketCardIdSchema.describe(
        'LLMQuant market card id from an event card, e.g. "pmm_253254".',
      ),
    }),
    execute: async ({ market_card_id }, context) => {
      try {
        const response = await getApiClient(api, context).readPolymarketMarket({
          marketCardId: market_card_id,
        });
        const item = response.data;

        return formatToolResult({
          summary: `Loaded Prediction Markets market "${item.marketQuestion}" with ${item.outcomes.length} outcome(s).`,
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
