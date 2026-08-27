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
      const parameters = strictParameters(
        tool.parameters,
        LEGACY_PARAMETER_REPLACEMENTS_BY_TOOL[tool.name],
      );
      server.addTool({
        ...tool,
        parameters,
        execute: async (args, context) => tool.execute(parameters.parse(args), context),
      });
    },
  };
}

/**
 * Maps removed parameter names to their current names for clear validation
 * messages.
 *
 * Replacements are scoped to each tool, so an error never suggests a parameter
 * that the selected tool does not accept.
 */
const LEGACY_PARAMETER_REPLACEMENTS_BY_TOOL: Record<
  string,
  Readonly<Record<string, string>>
> = {
  wiki_search: { topK: "limit", top_k: "limit" },
  paper_search: { topK: "limit", top_k: "limit" },
  macro_indicator_search: { q: "query" },
  polymarket_event_browse: { q: "query" },
};

export function describeUnrecognizedParameters(
  keys: readonly string[],
  legacyParameterReplacements: Readonly<Record<string, string>> = {},
) {
  const replacements = Array.from(
    new Set(keys.map((key) => legacyParameterReplacements[key]).filter(Boolean)),
  );

  if (replacements.length > 0) {
    const replacementList = replacements.map((replacement) => `"${replacement}"`).join(", ");
    return `Unrecognized parameter(s): use ${replacementList} instead. Remove any other unsupported parameters.`;
  }

  return "Unrecognized parameter(s): remove unsupported parameters.";
}

type StrictableSchema<Schema> = Schema & {
  strict?: () => Schema;
  clone?: (def: Record<string, unknown>) => Schema;
  _zod?: { def?: Record<string, unknown> };
};

function unrecognizedParameterErrorMap(issue: {
  code?: string;
  keys?: readonly string[];
}, legacyParameterReplacements: Readonly<Record<string, string>>) {
  if (issue.code !== "unrecognized_keys" || !issue.keys?.length) {
    return undefined;
  }

  return describeUnrecognizedParameters(issue.keys, legacyParameterReplacements);
}

function strictParameters<Schema extends z.ZodTypeAny>(
  schema: Schema,
  legacyParameterReplacements: Readonly<Record<string, string>> = {},
): Schema {
  const maybeObject = schema as StrictableSchema<Schema>;

  if (typeof maybeObject.strict !== "function") {
    return schema;
  }

  const strict = maybeObject.strict() as StrictableSchema<Schema>;
  const def = strict._zod?.def;

  if (typeof strict.clone !== "function" || !def) {
    return strict;
  }

  return strict.clone({
    ...def,
    error: (issue: { code?: string; keys?: readonly string[] }) =>
      unrecognizedParameterErrorMap(issue, legacyParameterReplacements),
  });
}
