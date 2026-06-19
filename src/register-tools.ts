import type { ApiClientProvider } from "./client/api-provider";
import type { McpToolRegistry } from "./tools/registry";
import { registerCryptoHistoricalTool } from "./tools/crypto-historical";
import { registerCryptoSnapshotTool } from "./tools/crypto-snapshot";
import { registerEquityHistoricalTool } from "./tools/equity-historical";
import { registerEtfHoldingsTool } from "./tools/etf-holdings";
import { registerEtfLookupTool } from "./tools/etf-lookup";
import { registerMacroIndicatorHistoryTool } from "./tools/macro-indicator-history";
import { registerMacroIndicatorSearchTool } from "./tools/macro-indicator-search";
import { registerMacroIndicatorSnapshotTool } from "./tools/macro-indicator-snapshot";
import { registerNewsBrowseTool } from "./tools/news-browse";
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
  registerSearchWikiTool(server, api);
  registerReadWikiTool(server, api);
  registerSearchPaperTool(server, api);
  registerReadPaperTool(server, api);
  registerCryptoHistoricalTool(server, api);
  registerCryptoSnapshotTool(server, api);
  registerPolymarketEventBrowseTool(server, api);
  registerPolymarketEventSearchTool(server, api);
  registerPolymarketEventReadTool(server, api);
  registerPolymarketMarketReadTool(server, api);
  registerPolymarketPriceHistoryTool(server, api);
  registerEquityHistoricalTool(server, api);
  registerMacroIndicatorSearchTool(server, api);
  registerMacroIndicatorHistoryTool(server, api);
  registerMacroIndicatorSnapshotTool(server, api);
  registerSecFilingBrowseTool(server, api);
  registerSecFilingReadTool(server, api);
  registerSec13fByManagerTool(server, api);
  registerSec13fByTickerTool(server, api);
  registerSec13fListTopManagersTool(server, api);
  registerEtfLookupTool(server, api);
  registerEtfHoldingsTool(server, api);
  if (process.env.NEWS_API_ENABLED === "true") {
    registerNewsBrowseTool(server, api);
  }
}
