import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { macroCatalogLimitSchema } from "../shared/schemas";

export function registerMacroIndicatorSearchTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "macro_indicator_search",
    description:
      "Search the curated U.S. macro indicators catalog (~50 series from FRED). " +
      "Categories: Growth, Consumption, Inflation, Labor, Housing, Rates, Inflation Expectations, Liquidity, Conditions, FX, Credit, Sentiment, Energy. " +
      "Key indicators include: us.cpi.headline (CPI), us.unemployment_rate, us.rates.fed_funds, us.yield.10y (10Y Treasury), " +
      "us.gdp.real, us.nonfarm_payrolls, us.pce.core (Fed's preferred inflation), us.yield_curve.10y_2y (recession signal), " +
      "us.housing_starts, us.money_supply.m2, us.financial_conditions.nfci, us.oil.wti_spot. " +
      "Call with no params to list all. Use category param to filter by theme.",
    parameters: z.object({
      q: z
        .string()
        .optional()
        .describe(
          "Keyword search matching indicator alias, title, or series_id.",
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Filter by category (e.g. Inflation, Rates, Labor, Growth, Housing, Consumption, FX, Conditions, Energy, Sentiment, Liquidity).",
        ),
      frequency: z
        .string()
        .optional()
        .describe(
          "Filter by frequency (e.g. Daily, Weekly, Monthly, Quarterly, Annual).",
        ),
      limit: macroCatalogLimitSchema
        .optional()
        .describe("Max results. Default: 20. Max: 100."),
    }),
    execute: async ({ q, category, frequency, limit }, context) => {
      try {
        const response = await getApiClient(api, context).getMacroIndicators({
          q,
          category,
          frequency,
          limit,
        });

        const summary =
          response.data.length === 0
            ? "No matching indicators found in the curated catalog."
            : `Found ${response.data.length} macro indicator(s).`;

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
