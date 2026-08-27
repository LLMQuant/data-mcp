import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_NEWS_LIMIT = 10;
const MAX_NEWS_LIMIT = 25;

// Executable mirror of the public News taxonomy. The Web boundary carries the
// same closed sets and rejects unknown filter values.
const NEWS_EVENT_VALUES = [
  "earnings",
  "guidance",
  "m_and_a",
  "partnership",
  "product",
  "regulatory_approval",
  "regulatory",
  "legal",
  "leadership_change",
  "workforce",
  "restructuring",
  "bankruptcy",
  "capital_action",
  "credit_rating",
  "analyst_rating",
  "accounting_audit",
  "operational_incident",
  "shareholder_meeting",
  "strategic_update",
  "other",
] as const;

const NEWS_TOPIC_VALUES = [
  "semiconductors",
  "software",
  "cloud_computing",
  "cybersecurity",
  "artificial_intelligence",
  "consumer_electronics",
  "it_hardware_networking",
  "telecommunications",
  "media_entertainment",
  "internet_services",
  "biotech_pharma",
  "medical_devices",
  "life_sciences_tools",
  "healthcare_services",
  "banking",
  "capital_markets",
  "insurance",
  "fintech",
  "crypto_digital_assets",
  "real_estate",
  "automotive",
  "retail",
  "consumer_packaged_goods",
  "apparel_luxury",
  "restaurants_leisure",
  "aerospace_defense",
  "industrial_machinery",
  "transportation_logistics",
  "construction_engineering",
  "business_services",
  "oil_gas",
  "renewable_energy",
  "utilities",
  "metals_mining",
  "chemicals",
  "agriculture_food_production",
  "paper_packaging_forestry",
  "environmental_services",
  "space_economy",
  "quantum_computing",
  "data_centers",
  "macroeconomics_policy",
  "geopolitics_trade",
] as const;

function isIsoCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;

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

// Every behavioral promise in the descriptions is enforced here at parse
// time, before the Web client runs (tool-expansion.md §十一).
const newsBrowseParameters = z
  .object({
    tickers: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(5)
      .optional()
      .describe("Optional equity symbols to OR together. Maximum: 5."),
    events: z
      .array(z.enum(NEWS_EVENT_VALUES))
      .min(1)
      .max(NEWS_EVENT_VALUES.length)
      .optional()
      .describe(
        "Optional controlled event values to OR together. Unknown returned values should be ignored.",
      ),
    topics: z
      .array(z.enum(NEWS_TOPIC_VALUES))
      .min(1)
      .max(NEWS_TOPIC_VALUES.length)
      .optional()
      .describe(
        "Optional controlled subject topics to OR together. Unknown returned values should be ignored.",
      ),
    start_date: z
      .string()
      .regex(DATE_RE, "start_date must be in YYYY-MM-DD format.")
      .refine(isIsoCalendarDate, {
        message: "start_date must be a valid YYYY-MM-DD calendar date.",
      })
      .optional()
      .describe(
        "Inclusive UTC start date. Must be used together with end_date.",
      ),
    end_date: z
      .string()
      .regex(DATE_RE, "end_date must be in YYYY-MM-DD format.")
      .refine(isIsoCalendarDate, {
        message: "end_date must be a valid YYYY-MM-DD calendar date.",
      })
      .optional()
      .describe(
        "Inclusive UTC end date. Must be used together with start_date.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_NEWS_LIMIT)
      .default(DEFAULT_NEWS_LIMIT)
      .describe("Maximum returned items. Default: 10. Maximum: 25."),
  })
  .refine((value) => Boolean(value.start_date) === Boolean(value.end_date), {
    message: "start_date and end_date must be used together.",
  })
  .refine(
    (value) =>
      !value.start_date || !value.end_date || value.start_date <= value.end_date,
    { message: "start_date must not be after end_date." },
  );

export function registerNewsBrowseTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "news_browse",
    description:
      "Browse recent company announcements across the covered market, optionally filtered by tickers, events, topics, or an inclusive date range. " +
      "Returns AI-written title, abstract, summary, controlled event/topic sets, publication date, and a link to the original announcement. " +
      "This is exact filtering, not semantic or text search.",
    parameters: newsBrowseParameters,
    execute: async (
      { tickers, events, topics, start_date, end_date, limit },
      context,
    ) => {
      try {
        const response = await getApiClient(api, context).getNewsBrowse({
          tickers,
          events,
          topics,
          startDate: start_date,
          endDate: end_date,
          limit,
        });

        const scope = tickers?.join(", ") ?? "the covered market";
        return formatToolResult({
          summary: `${scope}: ${response.data.items.length} recent news item(s).`,
          data: response.data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
