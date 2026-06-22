import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  personalAssetClassSchema,
  personalHoldingsLimitSchema,
} from "../shared/schemas";

export function registerPersonalHoldingsTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "personal_holdings",
    description:
      "Read the holdings you saved in your LLMQuant Dashboard → Profile. Use " +
      "this when the question is about the user's own portfolio (e.g. 'how " +
      "concentrated am I', 'what's in my portfolio', 'my crypto'). Returns " +
      "only your own saved positions; it cannot see anyone else's data and " +
      "does not place trades or read a live brokerage.\n\n" +
      "Inputs: optional asset_class filter (equity, etf, crypto, cash, fund, " +
      "bond, other); optional limit (default 30, max 50).\n\n" +
      "Returns: data.total_count plus data.holdings[] with each row's symbol, " +
      "name, asset_class, quantity, market_value, cost_basis (optional " +
      "aggregate total cost the user entered; per-share average can be derived " +
      "as cost_basis / quantity), currency, and as_of_date.\n\n" +
      "Credit rule: 0 credits. Empty portfolio returns total_count 0 with an " +
      "empty holdings list. Values are what the user typed in their profile, " +
      "not live market quotes.",
    parameters: z.object({
      asset_class: personalAssetClassSchema
        .optional()
        .describe(
          "Filter by asset class (equity, etf, crypto, cash, fund, bond, other). Omit to return all holdings.",
        ),
      limit: personalHoldingsLimitSchema
        .optional()
        .describe("Max holdings to return. Default 30, max 50."),
    }),
    execute: async ({ asset_class, limit }, context) => {
      try {
        const response = await getApiClient(api, context).getPersonalHoldings({
          ...(asset_class ? { assetClass: asset_class } : {}),
          ...(limit != null ? { limit } : {}),
        });
        const count = response.data.total_count;
        const summary =
          count === 0
            ? "No saved holdings found in your LLMQuant profile."
            : `Found ${count} saved holding(s) in your LLMQuant profile.`;
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
