import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  equityTickerSchema,
  secFilingTypeSchema,
  secLimitSchema,
} from "../shared/schemas";

export function registerSecFilingBrowseTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_filing_browse",
    description:
      "Browse SEC filings (10-K and 10-Q) for a U.S. ticker. Returns filing metadata only, not section text. " +
      "This is the first step in the progressive disclosure pattern: use browse to discover filings, " +
      "then call sec_filing_read to fetch one section. This is not a semantic search tool.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'U.S. equity ticker (e.g. "AAPL", "MSFT", "BRK.B").',
      ),
      filing_type: secFilingTypeSchema
        .optional()
        .describe('Optional filing type filter: "10-K" or "10-Q".'),
      limit: secLimitSchema
        .optional()
        .describe("Maximum filings to return. Default: 10. Max: 50."),
    }),
    execute: async ({ ticker, filing_type, limit }, context) => {
      try {
        const response = await getApiClient(api, context).getSecFilingBrowse({
          ticker,
          filingType: filing_type,
          limit,
        });

        const summary =
          response.data.length === 0
            ? `No SEC filings found for ${ticker}.`
            : `${ticker}: ${response.data.length} filing(s) returned.`;

        return formatToolResult({
          summary,
          items: response.data,
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
