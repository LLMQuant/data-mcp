import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LABEL_RE = /^(?:([a-z_]+):)?([a-z0-9_]+)$/;
const NEWS_LABEL_TYPES = ["event", "domain"] as const;
const MAX_NEWS_LABELS = 10;

function isIsoCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function hasValidNewsLabels(raw: string): boolean {
  const labels = raw
    .split(",")
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);

  return (
    labels.length > 0 &&
    labels.length <= MAX_NEWS_LABELS &&
    labels.every((label) => {
      const match = LABEL_RE.exec(label);
      if (!match) {
        return false;
      }
      const type = match[1];
      return !type || NEWS_LABEL_TYPES.includes(type as never);
    })
  );
}

// Every behavioral promise written in a .describe() below is enforced in this
// schema's refinements (parse stage) — never left to the Web route to honor.
// See contexts/mcp/design/tool-expansion.md §十一.
const newsBrowseParameters = z
  .object({
    ticker: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        'U.S. equity ticker, single or comma-separated for OR matching (e.g. "NVDA" or "AAPL,MSFT").',
      ),
    labels: z
      .string()
      .trim()
      .min(1)
      .refine(hasValidNewsLabels, {
        message:
          "labels must be comma-separated event/domain labels in type:name form; bare names default to domain.",
      })
      .optional()
      .describe(
        'Comma-separated controlled labels in type:name form, e.g. "event:results_of_operations,domain:ai". ' +
          "MVP input types: event, domain. A bare name defaults to domain. " +
          "Consumers should ignore unknown returned types/names as the taxonomy grows additively.",
      ),
    label_mode: z
      .enum(["any", "all"])
      .default("any")
      .describe('How multiple labels combine: "any" (default) or "all".'),
    source_type: z
      .enum(["company_8k", "press_release", "regulatory_news"])
      .optional()
      .describe(
        'Source type filter. Currently only "company_8k" (8-K EX-99.x press releases) has data.',
      ),
    start_date: z
      .string()
      .regex(DATE_RE, "start_date must be in YYYY-MM-DD format.")
      .refine(isIsoCalendarDate, {
        message: "start_date must be a valid YYYY-MM-DD calendar date.",
      })
      .optional()
      .describe(
        "Start of date range in YYYY-MM-DD format. Must be used with end_date (Range mode).",
      ),
    end_date: z
      .string()
      .regex(DATE_RE, "end_date must be in YYYY-MM-DD format.")
      .refine(isIsoCalendarDate, {
        message: "end_date must be a valid YYYY-MM-DD calendar date.",
      })
      .optional()
      .describe(
        "End of date range in YYYY-MM-DD format. Must be used with start_date.",
      ),
    limit: z
      .number()
      .int()
      .min(1, "limit must be at least 1.")
      .max(50, "limit must be 50 or less.")
      .optional()
      .describe(
        "Maximum articles for Recent mode (no dates). Default: 10. Max: 50. " +
          "Cannot be combined with start_date/end_date — in Range mode the full window is returned, paginated by cursor.",
      ),
    cursor: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Opaque pagination token from data.nextCursor. Pass it back unchanged; discard it when filters change.",
      ),
  })
  .refine((value) => value.ticker || value.labels || value.source_type, {
    message: "At least one of ticker, labels, or source_type is required.",
  })
  .refine((value) => Boolean(value.start_date) === Boolean(value.end_date), {
    message: "start_date and end_date must be used together.",
  })
  .refine(
    (value) =>
      !value.start_date || !value.end_date || value.start_date <= value.end_date,
    {
      message: "start_date must not be after end_date.",
    },
  )
  .refine(
    (value) => !(value.limit != null && value.start_date && value.end_date),
    {
      message:
        "limit cannot be combined with start_date/end_date; in range mode the full window is returned (paginated).",
    },
  );

export function registerNewsBrowseTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "news_browse",
    description:
      "List recent news articles for a ticker, controlled labels, source type, or date range. " +
      "Returns each article's source link, AI-generated summary, and controlled labels " +
      "so the agent can prune and cite news without leaving the API. " +
      "8-K-sourced articles carry a filingRef back to the SEC filing (use sec_filing_read for full text). " +
      "This is not a semantic search tool: all queries are exact parameterized filters.",
    parameters: newsBrowseParameters,
    execute: async (
      { ticker, labels, label_mode, source_type, start_date, end_date, limit, cursor },
      context,
    ) => {
      try {
        const response = await getApiClient(api, context).getNewsBrowse({
          ticker,
          labels,
          labelMode: label_mode,
          sourceType: source_type,
          startDate: start_date,
          endDate: end_date,
          limit,
          cursor,
        });

        const scope = ticker ?? labels ?? source_type ?? "news";
        const range =
          start_date && end_date ? ` from ${start_date} to ${end_date}` : "";
        const summary =
          response.data.items.length === 0
            ? `No news articles found for ${scope}${range}.`
            : `${scope}: ${response.data.items.length} news article(s)${range}.`;

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
