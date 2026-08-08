import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { searchLimitSchema, wikiQuerySchema } from "../shared/schemas";

export function registerSearchWikiTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "wiki_search",
    description:
      "Semantic search over the LLMQuant wiki knowledge base. Use this first to locate the most relevant wiki item IDs before calling wiki_read.",
    parameters: z.object({
      query: wikiQuerySchema.describe(
        "Search query. Maximum length is 2000 characters.",
      ),
      limit: searchLimitSchema
        .describe("Number of results to return. Defaults to 5 and cannot exceed 10.")
        .default(5),
    }),
    execute: async ({ query, limit }, context) => {
      try {
        const response = await getApiClient(api, context).searchWiki({ query, limit });
        const summary =
          response.data.length === 0
            ? `No wiki results found for "${query}".`
            : `Found ${response.data.length} wiki result(s) for "${query}". Use wiki_read with a wikiItemId to load the full entry.`;

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
