import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  earliestHasStartDate,
  equityIntradayDateSchema,
  equityIntradayIntervalSchema,
  equityIntradayLimitSchema,
  equityTickerSchema,
  orderedDateRange,
  takeFromSchema,
} from "../shared/schemas";

const INTRADAY_MAX_RANGE_DAYS = 14;

// Window-width cap message: must state the cap and an actionable next step.
// Kept byte-identical with the Web route message.
const INTRADAY_RANGE_LIMIT_MESSAGE =
  `date range must be ${INTRADAY_MAX_RANGE_DAYS} calendar days or less; ` +
  "when end_date is omitted it defaults to the current US Eastern date. " +
  "Narrow the window, or use equity_historical_prices for daily bars over longer periods.";

export function registerEquityIntradayTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "equity_intraday_prices",
    description:
      "Query US equity 1h intraday OHLCV bars by regular-session trading date. " +
      "Use start_date/end_date to bound the window; single boundaries are allowed. " +
      "The queried window must be 14 calendar days or less: when end_date is omitted it defaults to the current US Eastern date, " +
      "so a start_date more than 14 days back is rejected — use equity_historical_prices for longer daily-bar history. " +
      "limit keeps at most N bars, take_from chooses latest or earliest candidates, and results return oldest first.",
    parameters: z
      .object({
        ticker: equityTickerSchema.describe(
          'US equity ticker (e.g. "AAPL", "MSFT", "BRK.B", "^GSPC" for S&P 500 index).',
        ),
        interval: equityIntradayIntervalSchema
          .optional()
          .describe('Intraday interval. Currently supports "1h".'),
        start_date: equityIntradayDateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD trading-date window start.",
          ),
        end_date: equityIntradayDateSchema
          .optional()
          .describe(
            "Inclusive YYYY-MM-DD trading-date window end.",
          ),
        limit: equityIntradayLimitSchema
          .optional()
          .describe(
            "Maximum 1h bars to keep after date filtering. Default: 35. Max: 70.",
          ),
        take_from: takeFromSchema
          .default("latest")
          .describe(
            'Which side of the filtered window to keep when more than limit bars match. Default: "latest".',
          ),
      })
      .refine(orderedDateRange, {
        message: "start_date must not be after end_date.",
      })
      .refine(intradayWindowWithinLimit, {
        message: INTRADAY_RANGE_LIMIT_MESSAGE,
      })
      .refine(earliestHasStartDate, {
        message: "take_from=earliest requires start_date.",
      }),
    execute: async (
      { ticker, interval, start_date, end_date, limit, take_from },
      context,
    ) => {
      try {
        const effectiveInterval = interval ?? "1h";
        if (effectiveInterval !== "1h") {
          throw new Error('interval must be "1h".');
        }

        const effectiveTakeFrom = take_from ?? "latest";
        assertHistoricalWindow({
          start: start_date,
          end: end_date,
          takeFrom: effectiveTakeFrom,
          startName: "start_date",
          endName: "end_date",
        });
        assertIntradayWindowWithinLimit(start_date, end_date);

        const response = await getApiClient(api, context).getEquityIntraday({
          ticker,
          interval: "1h",
          startDate: start_date,
          endDate: end_date,
          limit,
          takeFrom: effectiveTakeFrom,
        });

        const summary =
          response.data.prices.length === 0
            ? `No 1h intraday price data found for ${ticker}.`
            : `${ticker} 1h intraday prices: ${response.data.prices.length} bar(s).`;

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

function assertHistoricalWindow({
  start,
  end,
  takeFrom,
  startName,
  endName,
}: {
  start?: string;
  end?: string;
  takeFrom: "latest" | "earliest";
  startName: string;
  endName: string;
}) {
  if (takeFrom === "earliest" && !start) {
    throw new Error(`take_from=earliest requires ${startName}.`);
  }

  if (start && end && Date.parse(`${start}T00:00:00Z`) > Date.parse(`${end}T00:00:00Z`)) {
    throw new Error(`${startName} must not be after ${endName}.`);
  }
}

// The cap applies to the *effective* window: end_date defaults to the current
// Eastern date on the Web side, so `start_date` alone can still be over-wide.
function intradayWindowWithinLimit(value: { start_date?: string; end_date?: string }) {
  if (!value.start_date) {
    return true;
  }

  const effectiveEnd = value.end_date ?? currentEasternDate();
  const days = countInclusiveCalendarDays(value.start_date, effectiveEnd);
  // A future-dated start_date inverts the effective window and yields a
  // non-positive day count, which must not slip through the upper bound.
  return days >= 1 && days <= INTRADAY_MAX_RANGE_DAYS;
}

function assertIntradayWindowWithinLimit(start?: string, end?: string) {
  if (start && !intradayWindowWithinLimit({ start_date: start, end_date: end })) {
    throw new Error(INTRADAY_RANGE_LIMIT_MESSAGE);
  }
}

function countInclusiveCalendarDays(startDate: string, endDate: string) {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

const EASTERN_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function currentEasternDate(): string {
  const parts = EASTERN_DATE_FORMATTER.formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
