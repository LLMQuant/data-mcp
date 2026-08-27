import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  equityTickerSchema,
  secAccessionNumberSchema,
  secFilingTypeSchema,
  secItemsSchema,
  secQuarterSchema,
  secYearSchema,
} from "../shared/schemas";

function formatCharCount(value: number) {
  return value.toLocaleString("en-US");
}

/**
 * Filing locator contract.
 *
 * Three closed shapes instead of a flat bag of optional fields, so the legal
 * combinations are visible in the exported JSON Schema rather than something a
 * model has to discover through repeated validation errors.
 *
 * Every branch is `.strict()` on purpose: a zod object strips unknown keys by
 * default, which would turn a mixed locator into silently dropping the extra
 * field and returning anyway.
 */
const FILING_LOCATOR_ERROR =
  "filing must match exactly one of three shapes: " +
  '{"filing_type":"10-K","year":2024} to read an annual report; ' +
  '{"filing_type":"10-Q","year":2025,"quarter":2} to read a quarterly report; ' +
  '{"filing_type":"10-K"|"10-Q"|"8-K","accession_number":"0000320193-26-000050"} to read one exact filing. ' +
  "Send only the fields the chosen shape lists: do not combine year or quarter with accession_number, " +
  "do not add quarter to a 10-K, and do not pass a placeholder string for a field you want to leave out. " +
  "8-K can only be read by accession_number — call sec_filing_browse first to get one.";

const PERIOD_YEAR_DESCRIPTION =
  "Calendar year of the period the report covers (period_of_report), not the date it was filed.";

const filingLocatorSchema = z
  .union(
    [
      z
        .object({
          filing_type: z
            .enum(["10-K"])
            .describe("Annual report. This shape reads one 10-K by year."),
          year: secYearSchema.describe(PERIOD_YEAR_DESCRIPTION),
        })
        .strict(),
      z
        .object({
          filing_type: z
            .enum(["10-Q"])
            .describe("Quarterly report. This shape reads one 10-Q by year and quarter."),
          year: secYearSchema.describe(PERIOD_YEAR_DESCRIPTION),
          quarter: secQuarterSchema.describe(
            "Quarter (1-4) of the period the report covers. Required in this shape.",
          ),
        })
        .strict(),
      z
        .object({
          filing_type: secFilingTypeSchema.describe(
            'Filing type of the exact filing being read: "10-K", "10-Q", or "8-K".',
          ),
          accession_number: secAccessionNumberSchema.describe(
            'Exact SEC accession number from sec_filing_browse, e.g. "0000320193-26-000050". This is the only way to read an 8-K.',
          ),
        })
        .strict(),
    ],
    { error: () => FILING_LOCATOR_ERROR },
  )
  .describe(
    "Which filing to read. Choose exactly one of three shapes: annual period (10-K + year), " +
      "quarterly period (10-Q + year + quarter), or exact filing (filing_type + accession_number, " +
      "the only shape that can read an 8-K). Each shape accepts only the fields it lists.",
  );

export function registerSecFilingReadTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "sec_filing_read",
    description:
      "Read one or more sections from a SEC 10-K, 10-Q, or 8-K filing. This is the second step in the progressive disclosure pattern: " +
      "sec_filing_browse returns filing metadata (including filingType, accessionNumber, and sectionKeys), then this tool returns the section text. " +
      "Locate the filing with the required `filing` object, which takes exactly one of three shapes: " +
      'annual period {"filing_type":"10-K","year":2024}; quarterly period {"filing_type":"10-Q","year":2025,"quarter":2}; ' +
      'or exact filing {"filing_type":"10-K"|"10-Q"|"8-K","accession_number":"0000320193-26-000050"}. ' +
      "Map browse camelCase outputs to snake_case inputs: filingType -> filing.filing_type, accessionNumber -> filing.accession_number, sectionKeys -> items. " +
      "Send only the fields the chosen shape lists; anything else is rejected. " +
      "8-K is event-driven with many filings per year, so it can only be read by accession_number — browse first, then read. " +
      'Pass `items` to fetch a batch in one call, e.g. items=["item2.02","item9.01"]; omit `items` to fetch every available section. ' +
      'Common 10-K items: "1", "1A", "7", "8". Common 10-Q items: "part1item2", "part2item1a". ' +
      'Common 8-K items: "item2.02" (earnings press release), "item5.02" (executive changes), "ex99.1" (exhibit). ' +
      "Each filing type uses a different item code system. " +
      "A requested code the filing does not have is dropped from the result (check available_sections); if no requested section is available, the result returns an empty items array with an explanatory notice. " +
      "This is not a semantic search tool.",
    parameters: z.object({
      ticker: equityTickerSchema.describe(
        'U.S. equity ticker (e.g. "AAPL", "NVDA", "META").',
      ),
      filing: filingLocatorSchema,
      items: secItemsSchema
        .optional()
        .describe(
          'Optional batch of section keys. Examples: 10-K -> ["1A","7","8"]; 10-Q -> ["part1item2","part2item1a"]; 8-K -> ["item2.02","item9.01","ex99.1"]. Codes absent from the filing are dropped (see available_sections). Omit to fetch all available sections. Max 25.',
        ),
    }),
    execute: async ({ ticker, filing, items }, context) => {
      try {
        // The three locator shapes flatten back into the existing query
        // parameters here; `GET /api/filings/sections` is unchanged.
        const response = await getApiClient(api, context).getSecFilingRead({
          ticker,
          filingType: filing.filing_type,
          year: "year" in filing ? filing.year : undefined,
          quarter: "quarter" in filing ? filing.quarter : undefined,
          items,
          accessionNumber:
            "accession_number" in filing ? filing.accession_number : undefined,
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
