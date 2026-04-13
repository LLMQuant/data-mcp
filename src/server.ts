import { createRequire } from "node:module";
import { FastMCP } from "fastmcp";

import type { LlmquantEnv } from "./env";
import { LlmquantWebApiClient } from "./client/web-api";
import { registerCryptoHistoricalTool } from "./tools/crypto-historical";
import { registerCryptoSnapshotTool } from "./tools/crypto-snapshot";
import { registerEquityHistoricalTool } from "./tools/equity-historical";
import { registerMacroIndicatorHistoryTool } from "./tools/macro-indicator-history";
import { registerMacroIndicatorSearchTool } from "./tools/macro-indicator-search";
import { registerMacroIndicatorSnapshotTool } from "./tools/macro-indicator-snapshot";
import { registerReadPaperTool } from "./tools/read-paper";
import { registerSecFilingBrowseTool } from "./tools/sec-filing-browse";
import { registerSecFilingReadTool } from "./tools/sec-filing-read";
import { registerReadWikiTool } from "./tools/read-wiki";
import { registerSearchPaperTool } from "./tools/search-paper";
import { registerSearchWikiTool } from "./tools/search-wiki";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as {
  version: `${number}.${number}.${number}`;
};

export function createServer(env: LlmquantEnv) {
  const server = new FastMCP({
    name: "LLMQuant Data",
    version,
  });

  const api = new LlmquantWebApiClient(env);

  registerSearchWikiTool(server, api);
  registerReadWikiTool(server, api);
  registerSearchPaperTool(server, api);
  registerReadPaperTool(server, api);
  registerCryptoHistoricalTool(server, api);
  registerCryptoSnapshotTool(server, api);
  registerEquityHistoricalTool(server, api);
  registerMacroIndicatorSearchTool(server, api);
  registerMacroIndicatorHistoryTool(server, api);
  registerMacroIndicatorSnapshotTool(server, api);
  registerSecFilingBrowseTool(server, api);
  registerSecFilingReadTool(server, api);

  return server;
}
