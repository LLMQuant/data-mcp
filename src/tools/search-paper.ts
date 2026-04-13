import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { searchQuerySchema, topKSchema } from "../shared/schemas";

function roundScore(value: number) {
  return Number(value.toFixed(4));
}

export function registerSearchPaperTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "paper_search",
    description:
      "Semantic search over LLMQuant paper knowledge cards. Use this first to locate the most relevant paperCardId values before calling paper_read.",
    parameters: z.object({
      query: searchQuerySchema.describe(
        "Search query. Maximum length is 2000 characters.",
      ),
      topK: topKSchema
        .describe("Number of results to return. Defaults to 5 and cannot exceed 10.")
        .default(5),
    }),
    execute: async ({ query, topK }) => {
      try {
        const response = await api.searchPaper({ query, topK });
        const items = response.data.map((item) => ({
          paperCardId: item.paperCardId,
          sourcePaperId: item.sourcePaperId,
          title: item.title,
          authors: item.authors,
          abstract: item.abstract,
          summary: item.summary,
          tags: item.tags,
          availableSections: item.availableSections,
          sectionCount: item.sectionCount,
          fullTextCharCount: item.fullTextCharCount,
          pdfUrl: item.pdfUrl,
          semanticScore: roundScore(item.semanticScore),
        }));

        const summary =
          items.length === 0
            ? `No paper results found for "${query}".`
            : `Found ${items.length} paper result(s) for "${query}". Use paper_read with a paperCardId to load sections.`;

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
