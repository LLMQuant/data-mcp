import type { ApiClientProvider } from "./client/api-provider";
import type { McpToolRegistry } from "./tools/registry";
import { z } from "zod";
import { registerCryptoHistoricalTool } from "./tools/crypto-historical";
import { registerCryptoSnapshotTool } from "./tools/crypto-snapshot";
import { registerEquityHistoricalTool } from "./tools/equity-historical";
import { registerEquityIntradayTool } from "./tools/equity-intraday";
import { registerEtfHoldingsTool } from "./tools/etf-holdings";
import { registerEtfLookupTool } from "./tools/etf-lookup";
import { registerMacroIndicatorHistoryTool } from "./tools/macro-indicator-history";
import { registerMacroIndicatorSearchTool } from "./tools/macro-indicator-search";
import { registerMacroIndicatorSnapshotTool } from "./tools/macro-indicator-snapshot";
import { registerNewsBrowseTool } from "./tools/news-browse";
import { registerPersonalHoldingsTool } from "./tools/personal-holdings";
import { registerPersonalProfileTool } from "./tools/personal-profile";
import { registerPolymarketEventBrowseTool } from "./tools/polymarket-event-browse";
import { registerPolymarketEventReadTool } from "./tools/polymarket-event-read";
import { registerPolymarketEventSearchTool } from "./tools/polymarket-event-search";
import { registerPolymarketMarketReadTool } from "./tools/polymarket-market-read";
import { registerPolymarketPriceHistoryTool } from "./tools/polymarket-price-history";
import { registerReadPaperTool } from "./tools/read-paper";
import { registerReadWikiTool } from "./tools/read-wiki";
import { registerSearchPaperTool } from "./tools/search-paper";
import { registerSearchWikiTool } from "./tools/search-wiki";
import { registerSec13fByManagerTool } from "./tools/sec-13f-by-manager";
import { registerSec13fByTickerTool } from "./tools/sec-13f-by-ticker";
import { registerSec13fListTopManagersTool } from "./tools/sec-13f-list-top-managers";
import { registerSecFilingBrowseTool } from "./tools/sec-filing-browse";
import { registerSecFilingReadTool } from "./tools/sec-filing-read";

export function registerLlmquantDataTools(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  const strictServer = strictRegistry(server);

  registerSearchWikiTool(strictServer, api);
  registerReadWikiTool(strictServer, api);
  registerSearchPaperTool(strictServer, api);
  registerReadPaperTool(strictServer, api);
  registerCryptoHistoricalTool(strictServer, api);
  registerCryptoSnapshotTool(strictServer, api);
  registerPolymarketEventBrowseTool(strictServer, api);
  registerPolymarketEventSearchTool(strictServer, api);
  registerPolymarketEventReadTool(strictServer, api);
  registerPolymarketMarketReadTool(strictServer, api);
  registerPolymarketPriceHistoryTool(strictServer, api);
  registerEquityHistoricalTool(strictServer, api);
  registerEquityIntradayTool(strictServer, api);
  registerMacroIndicatorSearchTool(strictServer, api);
  registerMacroIndicatorHistoryTool(strictServer, api);
  registerMacroIndicatorSnapshotTool(strictServer, api);
  registerSecFilingBrowseTool(strictServer, api);
  registerSecFilingReadTool(strictServer, api);
  registerSec13fByManagerTool(strictServer, api);
  registerSec13fByTickerTool(strictServer, api);
  registerSec13fListTopManagersTool(strictServer, api);
  registerEtfLookupTool(strictServer, api);
  registerEtfHoldingsTool(strictServer, api);
  registerPersonalHoldingsTool(strictServer, api);
  registerPersonalProfileTool(strictServer, api);
  registerNewsBrowseTool(strictServer, api);
}

function strictRegistry(server: McpToolRegistry): McpToolRegistry {
  return {
    addTool(tool) {
      const parameters = strictParameters(tool.parameters);
      server.addTool({
        ...tool,
        parameters,
        execute: async (args, context) => tool.execute(parameters.parse(args), context),
      });
    },
  };
}

/**
 * Public parameter names that were renamed by the query-contract refactor
 * (tool-query-contract.md §六 B7/B8). The registry-level strict wrapper rejects
 * the old names; without this map an Agent only sees zod's default
 * `Unrecognized key: "topK"` and is never told what to send instead. Kept
 * byte-identical with the hosted registry's copy in `lib/mcp-vercel.ts`.
 */
const RENAMED_TOOL_PARAMETERS: Record<string, string> = {
  topK: "limit",
  top_k: "limit",
  q: "query",
};

export function describeUnrecognizedParameters(keys: readonly string[]) {
  const details = keys.map((key) => {
    const replacement = RENAMED_TOOL_PARAMETERS[key];
    return replacement
      ? `"${key}" was renamed to "${replacement}"`
      : `"${key}" is not a supported parameter`;
  });

  return `Unrecognized parameter(s): ${details.join("; ")}.`;
}

type StrictableSchema<Schema> = Schema & {
  strict?: () => Schema;
  clone?: (def: Record<string, unknown>) => Schema;
  _zod?: { def?: Record<string, unknown> };
};

function unrecognizedParameterErrorMap(issue: {
  code?: string;
  keys?: readonly string[];
}) {
  if (issue.code !== "unrecognized_keys" || !issue.keys?.length) {
    return undefined;
  }

  return describeUnrecognizedParameters(issue.keys);
}

function strictParameters<Schema extends z.ZodTypeAny>(schema: Schema): Schema {
  const maybeObject = schema as StrictableSchema<Schema>;

  if (typeof maybeObject.strict !== "function") {
    return schema;
  }

  const strict = maybeObject.strict() as StrictableSchema<Schema>;
  const def = strict._zod?.def;

  if (typeof strict.clone !== "function" || !def) {
    return strict;
  }

  return strict.clone({ ...def, error: unrecognizedParameterErrorMap });
}
