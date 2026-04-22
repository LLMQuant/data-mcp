import { z } from "zod";

export const searchQuerySchema = z
  .string()
  .trim()
  .min(1, "query is required.")
  .max(2_000, "query must be 2000 characters or less.");

export const wikiQuerySchema = searchQuerySchema;

export const topKSchema = z
  .number()
  .int()
  .min(1, "topK must be at least 1.")
  .max(10, "topK must be 10 or less.");

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

export const secFilingTypeSchema = z.enum(["10-K", "10-Q"]);

export const secLimitSchema = z
  .number()
  .int()
  .min(1, "limit must be at least 1.")
  .max(50, "limit must be 50 or less.");

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

export const sec13fPeriodSchema = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/u,
    "period must be in YYYY-MM-DD format (quarter-end date).",
  );

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
