import type { FastMCP } from "fastmcp";
import { z } from "zod";

import type { LlmquantWebApiClient } from "../client/web-api";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";
import { macroIndicatorSchema } from "../shared/schemas";

export function registerMacroIndicatorSnapshotTool(
  server: FastMCP,
  api: LlmquantWebApiClient,
) {
  server.addTool({
    name: "macro_indicator_snapshot",
    description:
      "Get the latest observation and previous value for a U.S. macro indicator. " +
      "Returns latest value, previous value, absolute delta, and percent change. " +
      "Useful for questions like 'What is the current CPI?', 'Has the Fed Funds rate changed?', 'Latest unemployment rate?'. " +
      "Common indicators: us.cpi.headline, us.unemployment_rate, us.rates.fed_funds, us.yield.10y, us.gdp.real, us.pce.core.",
    parameters: z.object({
      indicator: macroIndicatorSchema
        .optional()
        .describe(
          'Indicator alias (e.g. "us.cpi.headline", "us.unemployment_rate"). Use this OR series_id.',
        ),
      series_id: z
        .string()
        .optional()
        .describe(
          'FRED series ID (e.g. "UNRATE"). Use this OR indicator. Must be in the allowlist.',
        ),
    }),
    execute: async ({ indicator, series_id }) => {
      try {
        const response = await api.getMacroSnapshot({
          indicator,
          seriesId: series_id,
        });

        const id = response.data.indicator || response.data.seriesId;
        const latestVal = response.data.latest?.value;
        const deltaStr =
          response.data.deltaPct != null
            ? `, delta ${response.data.deltaPct >= 0 ? "+" : ""}${response.data.deltaPct}%`
            : "";

        const summary =
          latestVal != null
            ? `${id} latest: ${latestVal}${deltaStr}`
            : `No observations available for ${id}.`;

        return formatToolResult({
          summary,
          item: response.data,
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
