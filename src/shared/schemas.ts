import { z } from "zod";

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "query is required.")
  .max(2_000, "query must be 2000 characters or less.");

export const lexicalFilterQuerySchema = z
  .string()
  .trim()
  .min(1, "query is required.")
  .max(200, "query must be 200 characters or less.");

export const wikiQuerySchema = searchQuerySchema;

export const searchLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(10, "limit must be 10 or less.");

export const takeFromSchema = z.enum(["latest", "earliest"]);

/**
 * Parse-time guards for historical-series boundaries. These run as zod
 * refinements so a bad window fails before `execute()`. Equivalent
 * `execute()` checks stay in place for direct callers that bypass the registry
 * wrapper.
 */
export function earliestHasStartDate<
  T extends { start_date?: string; take_from?: "latest" | "earliest" },
>(value: T) {
  return value.take_from !== "earliest" || Boolean(value.start_date);
}

export function earliestHasStartTime<
  T extends { start_time?: string; take_from?: "latest" | "earliest" },
>(value: T) {
  return value.take_from !== "earliest" || Boolean(value.start_time);
}

export function orderedDateRange<T extends { start_date?: string; end_date?: string }>(
  value: T,
) {
  return (
    !value.start_date ||
    !value.end_date ||
    Date.parse(`${value.start_date}T00:00:00Z`) <=
      Date.parse(`${value.end_date}T00:00:00Z`)
  );
}

export function orderedTimeRange<T extends { start_time?: string; end_time?: string }>(
  value: T,
) {
  return (
    !value.start_time ||
    !value.end_time ||
    Date.parse(value.start_time) <= Date.parse(value.end_time)
  );
}

export const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "date must be in YYYY-MM-DD format.")
  .refine(isIsoCalendarDate, "date must be a valid YYYY-MM-DD calendar date.");

export const isoUtcDateTimeSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u,
    "datetime must be ISO 8601 UTC.",
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "datetime must be a valid ISO 8601 UTC timestamp.",
  })
  .refine(
    (value) => isIsoCalendarDate(value.slice(0, 10)),
    "datetime must be a valid ISO 8601 UTC timestamp.",
  );

export const wikiItemIdSchema = z
  .string()
  .trim()
  .min(1, "wikiItemId is required.");

export const paperCardIdSchema = z
  .string()
  .trim()
  .uuid("paperCardId must be a valid UUID.");

export const paperSectionKeySchema = z
  .string()
  .trim()
  .min(1, "section keys must not be empty.");

export const paperSectionsSchema = z
  .array(paperSectionKeySchema)
  .min(1, "sections must contain at least one section key.");

export const maxLengthSchema = z
  .number()
  .int()
  .positive("maxLength must be a positive integer.");

export const tickerSchema = z
  .string()
  .trim()
  .min(1, "ticker is required.")
  .regex(/^[A-Za-z]+-[A-Za-z]+$/u, "ticker must be in BASE-QUOTE format (e.g. BTC-USD).");

export const intervalSchema = z
  .enum(["1h", "4h", "1d", "1w"]);

export const cryptoLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(200, "limit must be 200 or less.");

export const equityTickerSchema = z
  .string()
  .trim()
  .min(1, "ticker is required.")
  .regex(/^[A-Za-z^][A-Za-z0-9.^]*$/u, "ticker must be a valid equity symbol (e.g. AAPL, BRK.B, ^GSPC).");

export const equityLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(200, "limit must be 200 or less.");

export const equityIntradayIntervalSchema = z.enum(["1h"]);

export const equityIntradayLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(70, "limit must be 70 or less.");

const EQUITY_INTRADAY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

function isIsoCalendarDate(value: string): boolean {
  if (!EQUITY_INTRADAY_DATE_RE.test(value)) {
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

export const equityIntradayDateSchema = z
  .string()
  .trim()
  .regex(EQUITY_INTRADAY_DATE_RE, "date must be in YYYY-MM-DD format.")
  .refine(isIsoCalendarDate, "date must be a valid YYYY-MM-DD calendar date.");

export const macroIndicatorSchema = z
  .string()
  .trim()
  .min(1, "indicator is required.");

export const macroLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(500, "limit must be 500 or less.");

export const macroCatalogLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(100, "limit must be 100 or less.");

export const secFilingTypeSchema = z.enum(["10-K", "10-Q", "8-K"]);

export const secLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(50, "limit must be 50 or less.");

export const secItemsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "each item must not be empty."),
  )
  .min(1, "items must contain at least one section key.")
  .max(25, "items must contain 25 or fewer section keys.");

/**
 * SEC accession numbers always look like `0000320193-26-000050`. Pinning the
 * shape stops a model from attempting to omit the field by passing placeholder
 * text such as `:none`. Non-matching strings are rejected during validation.
 */
export const secAccessionNumberSchema = z
  .string()
  .regex(
    /^\d{10}-\d{2}-\d{6}$/u,
    'accession_number must look like "0000320193-26-000050" (10 digits, 2 digits, 6 digits). Use an accession_number returned by sec_filing_browse; placeholder text is not accepted.',
  );

export const secYearSchema = z
  .number()
  .int()
  .min(1900, "year must be 1900 or greater.")
  .max(2100, "year must be 2100 or less.");

export const secQuarterSchema = z
  .number()
  .int()
  .min(1, "quarter must be at least 1.")
  .max(4, "quarter must be 4 or less.");

export const sec13fManagerCikSchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,10}$/u,
    "manager_cik must be a numeric SEC CIK (1-10 digits, no leading zeros required).",
  );

export const sec13fManagerNameSchema = z
  .string()
  .trim()
  .min(1, "manager_name must not be empty.")
  .max(200, "manager_name must be 200 characters or less.");

// Note: 13F year/quarter input reuses the SEC-shared schemas above
// (secYearSchema / secQuarterSchema). 13F-specific narrowing (2013-2030
// coverage window) is enforced in the web service layer's quarterEndDate
// helper, not duplicated here.

export const sec13fByManagerLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(500, "limit must be 500 or less.");

export const sec13fByTickerLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(1000, "limit must be 1000 or less.");

export const sec13fTopManagersLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(1000, "limit must be 1000 or less.");

export const sec13fTickerSchema = z
  .string()
  .trim()
  .min(1, "ticker is required.")
  .regex(
    /^[A-Za-z][A-Za-z0-9.-]*$/u,
    "ticker must be a valid equity symbol (e.g. AAPL, NVDA, BRK.B).",
  );

export const etfTickerSchema = z
  .string()
  .trim()
  .min(1, "ticker is required.")
  .max(16, "ticker must be 16 characters or less.")
  .regex(
    /^[A-Za-z0-9.-]+$/u,
    "ticker must contain only letters, digits, '.' or '-' (e.g. SPY, BRK.B).",
  );

export const etfHoldingsLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(500, "limit must be 500 or less.");

export const asOfDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "as_of must be in YYYY-MM-DD format.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "as_of must be a valid calendar date.");

export const personalAssetClassSchema = z.enum([
  "equity",
  "etf",
  "crypto",
  "cash",
  "fund",
  "bond",
  "other",
]);

export const personalHoldingsLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(50, "limit must be 50 or less.");

export const polymarketStatusSchema = z.enum([
  "active",
  "inactive",
  "closed",
  "active_or_recently_closed",
]);

export const polymarketPriceIntervalSchema = z.enum(["1h", "1d"]);

export const polymarketBrowseLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(100, "limit must be 100 or less.");

export const polymarketSearchLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(20, "limit must be 20 or less.");

export const polymarketPriceLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(20_000, "limit must be 20000 or less.");

export const polymarketCardIdSchema = z
  .string()
  .trim()
  .min(1, "card id must not be empty.");

export const polymarketOutcomeTokenSchema = z
  .string()
  .trim()
  .min(1, "outcome_token_id must not be empty.");

export const polymarketNonNegativeNumberSchema = z
  .number()
  .min(0, "value must be non-negative.");

export const polymarketIsoDateTimeSchema = isoUtcDateTimeSchema;
