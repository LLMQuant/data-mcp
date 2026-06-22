import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  equityTickerSchema,
  secFilingTypeSchema,
  secItemsSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatCharCount(value: number) {
  return value.toLocaleString("en-US");
}

export function registerSecFilingReadTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_filing_read",
    description:
      "Read one or more sections from a SEC 10-K, 10-Q, or 8-K filing. This is the second step in the progressive disclosure pattern: " +
      "after sec_filing_browse returns filing metadata (including section_keys), use accession_number or year/quarter to fetch section text. " +
      'Pass `items` to fetch a batch in one call, e.g. items=["item2.02","item9.01"]; omit `items` to fetch every available section. ' +
      'Common 10-K items: "1", "1A", "7", "8". Common 10-Q items: "part1item2", "part2item1a". ' +
      'Common 8-K items: "item2.02" (earnings press release), "item5.02" (executive changes), "ex99.1" (exhibit). ' +
      "A requested code the filing does not have is dropped from the result (check available_sections); if no requested section is available, the result returns an empty items array with an explanatory notice. " +
      "Each filing type uses a different item code system. 8-K has many filings per year so it cannot be located by " +
      "year/quarter — browse first, then read by accession_number. This is not a semantic search tool.",
    parameters: z
      .object({
        ticker: equityTickerSchema.describe(
          'U.S. equity ticker (e.g. "AAPL", "NVDA", "META").',
        ),
        filing_type: secFilingTypeSchema.describe('Filing type: "10-K", "10-Q", or "8-K".'),
        year: secYearSchema
          .optional()
          .describe(
            "Calendar year of period_of_report. Required for 10-K, and required with quarter for 10-Q when accession_number is omitted. Not used for 8-K (locate by accession_number).",
          ),
        quarter: secQuarterSchema
          .optional()
          .describe(
            "Quarter of period_of_report (1-4). Only valid for 10-Q (and only when accession_number is omitted). Rejected for 10-K and 8-K.",
          ),
        items: secItemsSchema
          .optional()
          .describe(
            'Optional batch of section keys. Examples: 10-K -> ["1A","7","8"]; 10-Q -> ["part1item2","part2item1a"]; 8-K -> ["item2.02","item9.01","ex99.1"]. Codes absent from the filing are dropped (see available_sections). Omit to fetch all available sections. Max 25.',
          ),
        accession_number: z
          .string()
          .trim()
          .min(1, "accession_number must not be empty.")
          .optional()
          .describe(
            "Exact SEC accession number. Recommended after sec_filing_browse, and REQUIRED for 8-K. Cannot be combined with year or quarter.",
          ),
      })
      .refine(
        (val) =>
          !(val.accession_number && (val.year !== undefined || val.quarter !== undefined)),
        {
          message:
            "accession_number cannot be combined with year or quarter; pass accession_number alone, or pass year (+ quarter for 10-Q) without accession_number.",
          path: ["accession_number"],
        },
      )
      .refine((val) => !(val.filing_type === "8-K" && !val.accession_number), {
        message:
          "8-K filings require accession_number; run sec_filing_browse first to obtain it, then read by accession_number (year/quarter cannot locate an 8-K).",
        path: ["accession_number"],
      })
      .refine((val) => !(val.quarter !== undefined && val.filing_type !== "10-Q"), {
        message: "quarter is only valid for 10-Q filings.",
        path: ["quarter"],
      }),
    execute: async ({
      ticker,
      filing_type,
      year,
      quarter,
      items,
      accession_number,
    }, context) => {
      try {
        const response = await getApiClient(api, context).getSecFilingRead({
          ticker,
          filingType: filing_type,
          year,
          quarter,
          items,
          accessionNumber: accession_number,
        });

        const returned = response.data.items;
        // Pure forwarder: when Web sends a `meta.notice` (e.g. requested
        // section unavailable / filing not covered), surface it verbatim. Web
        // owns all coverage / "no data" phrasing now — MCP never invents it.
        // Otherwise build a guidance line purely from the public `data` payload
        // (section count, names, char lengths).
        let summary: string;
        if (response.meta.notice) {
          summary = response.meta.notice;
        } else if (returned.length === 0) {
          summary = `${ticker} ${response.data.filingType}: no section text returned.`;
        } else if (returned.length === 1) {
          const only = returned[0];
          summary = `${ticker} ${response.data.filingType} ${only.number} (${only.name}) — ${formatCharCount(only.text.length)} chars.`;
        } else {
          const totalChars = returned.reduce((sum, it) => sum + it.text.length, 0);
          summary = `${ticker} ${response.data.filingType}: ${returned.length} sections (${returned.map((it) => it.number).join(", ")}) — ${formatCharCount(totalChars)} chars total.`;
        }

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
