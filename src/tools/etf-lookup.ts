import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { asOfDateSchema, etfTickerSchema } from "../shared/schemas";

export function registerEtfLookupTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "etf_lookup",
    description:
      "Look up an ETF's fund identity, SEC mapping (CIK / series_id / class_id), " +
      "latest available SEC N-PORT regulatory snapshot, derived top holdings " +
      "summary, and source / coverage metadata for currently supported ETFs.\n\n" +
      "Inputs: ticker (case-insensitive; e.g. SPY, QQQ, VTI, SOXX, ARKK) " +
      "and optional as_of (YYYY-MM-DD; returns the latest snapshot at or " +
      "before that date).\n\n" +
      "Returns: data with fund identity (fund_name, issuer, asset_class, " +
      "category, cik, series_id, class_id), best-effort profile fields " +
      "(expense_ratio, aum, nav, market_price, premium_discount_pct, " +
      "inception_date, holdings_count), summary top_holdings (up to 10), " +
      "exposure breakdowns, and source/as_of_date/stale/coverage_status/" +
      "coverage_notice metadata.\n\n" +
      "Coverage semantics: full / partial / stale return profile + identity; " +
      "unsupported returns the registered fund row plus an explicit notice — " +
      "agents should branch on coverage_status rather than treating an empty " +
      "field set as 'no data'. BlackRock IBIT and DRAM return unsupported in " +
      "current ETF coverage; use this tool for fund context, NOT for price bars — " +
      "ETF historical prices flow through equity_historical_prices.",
    parameters: z.object({
      ticker: etfTickerSchema.describe(
        'ETF ticker (e.g. "SPY", "VTI", "QQQ", "SOXX", "ARKK"). Case-insensitive.',
      ),
      as_of: asOfDateSchema
        .optional()
        .describe("Optional period date. Returns the latest snapshot with as_of_date <= as_of."),
    }),
    execute: async ({ ticker, as_of }, context) => {
      try {
        const response = await getApiClient(api, context).getEtfLookup({
          ticker,
          ...(as_of ? { asOf: as_of } : {}),
        });
        const { coverage_status, fund_name, ticker: normalized } = response.data;
        const label = fund_name ? `${normalized} (${fund_name})` : normalized;
        const summary =
          coverage_status === "unsupported"
            ? `${label} is not supported by current ETF coverage — see coverage_notice.`
            : `${label} SEC N-PORT snapshot as_of_date=${response.data.as_of_date ?? "unknown"} (${coverage_status}).`;
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
