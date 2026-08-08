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
      "Browse SEC filing metadata for a U.S. ticker by filing date. " +
      "Filter by filing_type when needed; results are newest first. " +
      "Use sec_filing_read with an accession_number or period selector to fetch filing sections. " +
      "8-K is event-driven: browse first and pass accession_number to sec_filing_read; year/quarter cannot locate an 8-K. " +
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
