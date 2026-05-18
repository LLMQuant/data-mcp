import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { paperCardIdSchema, paperSectionsSchema } from "../shared/schemas";

function countChars(sections: { charCount: number }[]) {
  return sections.reduce((total, section) => total + section.charCount, 0);
}

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
        const item = response.data;
        const returnedCharCount = countChars(item.sections);

        return formatToolResult({
          summary: `Loaded ${item.sections.length} section(s) from paper "${item.title}".`,
          item,
          meta: {
            paperCardId,
            requestedSections: requestedAll ? ["all"] : sections,
            creditsUsed: response.meta.creditsUsed,
            remainingCredits: response.meta.remainingCredits,
            returnedSectionCount: item.sections.length,
            returnedCharCount,
            availableSectionCount: item.availableSections.length,
            fullTextRequested: requestedAll,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
