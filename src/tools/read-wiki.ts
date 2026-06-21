import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { maxLengthSchema, wikiItemIdSchema } from "../shared/schemas";

export function registerReadWikiTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
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
    execute: async ({ wikiItemId, maxLength }, context) => {
      try {
        const response = await getApiClient(api, context).readWikiItem({ wikiItemId, maxLength });
        const data = response.data;

        return formatToolResult({
          summary: `Loaded wiki item "${data.title}" (${data.slug}).`,
          data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
