import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  equityTickerSchema,
  secFilingTypeSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatCharCount(value: number) {
  return value.toLocaleString("en-US");
}

export function registerSecFilingReadTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "sec_filing_read",
    description:
      "Read one section from a SEC 10-K or 10-Q filing. This is the second step in the progressive disclosure pattern: " +
      "after sec_filing_browse returns filing metadata, use accession_number or year/quarter to fetch section text. " +
      'Common 10-K items: "1", "1A", "7", "8". Common 10-Q items: "part1item2", "part2item1a". ' +
      "10-K and 10-Q use different item code systems. This is not a semantic search tool.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'U.S. equity ticker (e.g. "AAPL", "NVDA", "META").',
      ),
      filing_type: secFilingTypeSchema.describe('Filing type: "10-K" or "10-Q".'),
      year: secYearSchema
        .optional()
        .describe(
          "Calendar year of period_of_report. Required for 10-K, and required with quarter for 10-Q when accession_number is omitted.",
        ),
      quarter: secQuarterSchema
        .optional()
        .describe(
          "Quarter of period_of_report (1-4). Only used for 10-Q when accession_number is omitted.",
        ),
      item: z
        .string()
        .trim()
        .min(1, "item must not be empty.")
        .optional()
        .describe(
          'Optional section key. Examples: 10-K -> "1A", "7", "8"; 10-Q -> "part1item2", "part2item1a". Omit to fetch all extractable sections.',
        ),
      accession_number: z
        .string()
        .trim()
        .min(1, "accession_number must not be empty.")
        .optional()
        .describe(
          "Exact SEC accession number. Recommended after sec_filing_browse. Cannot be combined with year or quarter.",
        ),
    }),
    execute: async ({
      ticker,
      filing_type,
      year,
      quarter,
      item,
      accession_number,
    }) => {
      try {
        const response = await api.getSecFilingRead({
          ticker,
          filingType: filing_type,
          year,
          quarter,
          item,
          accessionNumber: accession_number,
        });

        const firstItem = response.data.items[0];
        const summary = firstItem
          ? `${ticker} ${response.data.filingType} ${firstItem.number} (${firstItem.name}) — ${formatCharCount(firstItem.text.length)} chars.`
          : `${ticker} ${response.data.filingType}: no section text returned.`;

        return formatToolResult({
          summary,
          item: response.data,
          meta: {
            count: response.meta.count,
            creditsUsed: response.meta.creditsUsed,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
