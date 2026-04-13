import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { maxLengthSchema, wikiItemIdSchema } from "../shared/schemas";

export function registerReadWikiTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "wiki_read",
    description:
      "Read a single LLMQuant wiki item by ID. Use maxLength when you only want a shorter body preview.",
    parameters: z.object({
      wikiItemId: wikiItemIdSchema.describe(
        "The wiki item ID returned by wiki_search.",
      ),
      maxLength: maxLengthSchema
        .describe(
          "Optional character limit for bodyMarkdown. Use this to preview large entries before requesting the full text.",
        )
        .optional(),
    }),
    execute: async ({ wikiItemId, maxLength }) => {
      try {
        const response = await api.readWikiItem({ wikiItemId, maxLength });
        const item = response.data;
        const returnedBodyLength = item.bodyMarkdown?.length ?? 0;

        return formatToolResult({
          summary: `Loaded wiki item "${item.title}" (${item.slug}).`,
          item,
          meta: {
            wikiItemId,
            requestedMaxLength: maxLength ?? null,
            creditsUsed: 0,
            returnedBodyLength,
            possiblyTruncated:
              maxLength != null && returnedBodyLength >= maxLength,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
