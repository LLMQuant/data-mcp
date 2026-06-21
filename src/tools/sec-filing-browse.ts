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
      "Browse SEC filings (10-K, 10-Q, and 8-K) for a U.S. ticker. Returns filing metadata only, not section text. " +
      "This is the first step in the progressive disclosure pattern: use browse to discover filings, " +
      "then call sec_filing_read to fetch one section. For 8-K (which has many filings per year and no " +
      "year/quarter lookup), browse first to obtain the accession_number, then read by accession_number. " +
      "This is not a semantic search tool.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'U.S. equity ticker (e.g. "AAPL", "MSFT", "BRK.B").',
      ),
      filing_type: secFilingTypeSchema
        .optional()
        .describe('Optional filing type filter: "10-K", "10-Q", or "8-K".'),
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

        // Pure forwarder: surface Web's `meta.notice` as the human line when
        // present (e.g. "no filings" explanations); otherwise state the count.
        // Web owns all coverage / "no data" phrasing now — MCP never invents it.
        const summary =
          response.meta.notice ??
          `${ticker}: ${response.data.length} SEC filing(s) returned.`;

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
