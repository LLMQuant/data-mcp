import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { searchLimitSchema, searchQuerySchema } from "../shared/schemas";

export function registerSearchPaperTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "paper_search",
    description:
      "Semantic search over LLMQuant paper knowledge cards. Use this first to locate the most relevant paperCardId values before calling paper_read.",
    parameters: z.object({
      query: searchQuerySchema.describe(
        "Search query. Maximum length is 2000 characters.",
      ),
      limit: searchLimitSchema
        .describe("Number of results to return. Defaults to 5 and cannot exceed 10.")
        .default(5),
    }),
    execute: async ({ query, limit }, context) => {
      try {
        const response = await getApiClient(api, context).searchPaper({ query, limit });
        const summary =
          response.data.length === 0
            ? `No paper results found for "${query}".`
            : `Found ${response.data.length} paper result(s) for "${query}". Use paper_read with a paperCardId to load sections.`;

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
