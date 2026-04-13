import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { topKSchema, wikiQuerySchema } from "../shared/schemas";

function roundScore(value: number) {
  return Number(value.toFixed(4));
}

export function registerSearchWikiTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "wiki_search",
    description:
      "Semantic search over the LLMQuant wiki knowledge base. Use this first to locate the most relevant wiki item IDs before calling wiki_read.",
    parameters: z.object({
      query: wikiQuerySchema.describe(
        "Search query. Maximum length is 2000 characters.",
      ),
      topK: topKSchema
        .describe("Number of results to return. Defaults to 5 and cannot exceed 10.")
        .default(5),
    }),
    execute: async ({ query, topK }) => {
      try {
        const response = await api.searchWiki({ query, topK });
        const items = response.data.map((item) => ({
          wikiItemId: item.wikiItemId,
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          tags: item.tags,
          scores: {
            combined: roundScore(item.combinedScore),
            semantic: roundScore(item.semanticScore),
            lexical: roundScore(item.lexicalScore),
          },
        }));

        const summary =
          items.length === 0
            ? `No wiki results found for "${query}".`
            : `Found ${items.length} wiki result(s) for "${query}". Use wiki_read with a wikiItemId to load the full entry.`;

        return formatToolResult({
          summary,
          items,
          meta: {
            query,
            topK: response.meta.topK,
            creditsUsed: response.meta.creditsUsed,
            remainingCredits: response.meta.remainingCredits,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
