import { createRequire } from "node:module";
import { FastMCP } from "fastmcp";

import type { LlmquantEnv } from "./env";
import { LlmquantApiClientProvider } from "./client/api-provider";
import { registerLlmquantDataTools } from "./register-tools";
import { resolvePrincipal } from "./remote/principal";
import type { McpToolRegistry } from "./tools/registry";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as {
  version: `${number}.${number}.${number}`;
};

export function createServer(env: LlmquantEnv) {
  const server = new FastMCP({
    ...(env.transport === "httpStream"
      ? { authenticate: (request) => resolvePrincipal(env, request) }
      : {}),
    name: "LLMQuant Data",
    version,
  });

  const api = new LlmquantApiClientProvider(env);
  registerLlmquantDataTools(server as unknown as McpToolRegistry, api);

  return server;
}
