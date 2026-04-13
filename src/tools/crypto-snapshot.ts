import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { tickerSchema } from "../shared/schemas";

function formatPrice(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function registerCryptoSnapshotTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "crypto_snapshot",
    description:
      "Get the current price snapshot for a crypto asset (Binance Spot). Returns last trade price, 24h change, and 24h volume.",
    parameters: z.object({
      ticker: tickerSchema.describe(
        'Crypto ticker in BASE-QUOTE format (e.g. "BTC-USD", "ETH-USD").',
      ),
    }),
    execute: async ({ ticker }) => {
      try {
        const response = await api.getCryptoSnapshot({ ticker });
        const d = response.data;

        const summary = `${d.ticker} current price ${formatPrice(d.price)}, 24h ${formatPercent(d.dayChangePercent)}`;

        return formatToolResult({
          summary,
          item: {
            price: d.price,
            ticker: d.ticker,
            dayChange: d.dayChange,
            dayChangePercent: d.dayChangePercent,
            volume24h: d.volume24h,
            time: d.time,
          },
          meta: {
            creditsUsed: response.meta.creditsUsed,
          },
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
