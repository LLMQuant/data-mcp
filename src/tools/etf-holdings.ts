import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import {
  asOfDateSchema,
  etfHoldingsLimitSchema,
  etfTickerSchema,
} from "../shared/schemas";

export function registerEtfHoldingsTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "etf_holdings",
    description:
      "Retrieve the latest available SEC N-PORT regulatory holdings for an ETF " +
      "in LLMQuant Data's currently supported ETF range. Holdings are sorted " +
      "by weight desc and include identifiers (ticker, cusip, isin), shares, " +
      "market_value, and per-row source / as_of_date metadata so agents can " +
      "compute overlap, concentration, and exposure client-side.\n\n" +
      "Inputs: ticker (case-insensitive; e.g. SPY, VTI, ARKK); optional limit " +
      "(default 50, max 500); optional as_of (YYYY-MM-DD; returns the latest " +
      "snapshot at or before that date).\n\n" +
      "Returns: data.holdings[] with each row's holding_name, ticker, cusip, " +
      "isin, asset_type, sector, country, shares, market_value, weight " +
      "(decimal, e.g. 0.065 for 6.5%), notional_value, plus top-level " +
      "source / source_url / as_of_date / fetched_at / stale / " +
      "coverage_status / coverage_notice fields.\n\n" +
      "Credit rule: full / partial / stale consume 1 " +
      "credit; coverage_status=unsupported consumes 0 credits and still " +
      "returns a coverage envelope (no holdings rows).\n\n" +
      "Coverage: regulatory snapshot only — this is the latest available " +
      "SEC N-PORT filing, NOT current daily issuer holdings. Holdings ticker " +
      "is nullable for bonds, cash, derivatives, and non-U.S. positions — " +
      "use CUSIP / ISIN for cross-fund overlap. BlackRock IBIT and DRAM " +
      "return unsupported. For ETF price bars, use equity_historical_prices.",
    parameters: z.object({
      ticker: etfTickerSchema.describe(
        'ETF ticker (e.g. "SPY", "VTI", "QQQ", "SOXX", "ARKK"). Case-insensitive.',
      ),
      limit: etfHoldingsLimitSchema
        .optional()
        .describe("Max holdings rows. Default 50, max 500."),
      as_of: asOfDateSchema
        .optional()
        .describe("Optional period date. Returns the latest snapshot with as_of_date <= as_of."),
    }),
    execute: async ({ ticker, limit, as_of }, context) => {
      try {
        const response = await getApiClient(api, context).getEtfHoldings({
          ticker,
          ...(limit != null ? { limit } : {}),
          ...(as_of ? { asOf: as_of } : {}),
        });
        const { coverage_status, ticker: normalized } = response.data;
        const summary =
          coverage_status === "unsupported"
            ? `${normalized} is not supported by current ETF coverage — see coverage_notice.`
            : `${normalized} holdings (as_of_date=${response.data.as_of_date ?? "unknown"}, ${response.data.holdings.length} row(s), ${coverage_status}).`;
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
