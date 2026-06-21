import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
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
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "crypto_snapshot",
    description:
      "Get the current price snapshot for a crypto asset. Returns last trade price, 24h change, and 24h volume.",
    parameters: z.object({
      ticker: tickerSchema.describe(
        'Crypto ticker in BASE-QUOTE format (e.g. "BTC-USD", "ETH-USD").',
      ),
    }),
    execute: async ({ ticker }, context) => {
      try {
        const response = await getApiClient(api, context).getCryptoSnapshot({ ticker });
        const d = response.data;

        const summary = `${d.ticker} current price ${formatPrice(d.price)}, 24h ${formatPercent(d.dayChangePercent)}`;

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
