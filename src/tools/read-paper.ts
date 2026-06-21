import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { paperCardIdSchema, paperSectionsSchema } from "../shared/schemas";

export function registerReadPaperTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "paper_read",
    description:
      "Read one or more sections from a single LLMQuant paper card. Omit sections or pass ['all'] to load the full paper in section order.",
    parameters: z.object({
      paperCardId: paperCardIdSchema.describe(
        "The paperCardId returned by paper_search.",
      ),
      sections: paperSectionsSchema
        .describe(
          "Optional section keys from paper_search.availableSections. Pass ['all'] or omit to read every section.",
        )
        .optional()
        .default(["all"]),
    }),
    execute: async ({ paperCardId, sections }, context) => {
      try {
        const requestedAll = sections.some(
          (section) => section.toLowerCase() === "all",
        );
        const response = await getApiClient(api, context).readPaper({
          paperCardId,
          sections: requestedAll ? undefined : sections,
        });
        const data = response.data;

        return formatToolResult({
          summary: `Loaded ${data.sections.length} section(s) from paper "${data.title}".`,
          data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
