import assert from "node:assert/strict";
import test from "node:test";

import type { LlmquantEnv } from "../env";
import { LlmquantApiClientProvider } from "./api-provider";

const remoteEnv: LlmquantEnv = {
  apiKey: "process-api-key",
  baseUrl: "https://api.llmquantdata.test",
  timeoutMs: 1_500,
  transport: "httpStream",
  internalApiSecret: "internal-secret",
  mcpHost: "127.0.0.1",
  mcpPort: 8080,
  mcpInternalPort: 8081,
  mcpEndpoint: "/mcp",
  enablePathTokenProxy: true,
  allowedOrigins: [],
  rateLimitWindowMs: 60_000,
  rateLimitMax: 120,
};

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("remote provider fails closed without an authenticated principal", () => {
  const provider = new LlmquantApiClientProvider(remoteEnv);

  assert.throws(
    () => provider.getClient(),
    /Remote MCP request is missing authenticated principal/u,
  );
  assert.throws(
    () => provider.getClient({ session: {} }),
    /Remote MCP request is missing authenticated principal/u,
  );
});

test("remote provider fails closed without tools:read scope", () => {
  const provider = new LlmquantApiClientProvider(remoteEnv);

  assert.throws(
    () =>
      provider.getClient({
        session: {
          user_id: "user-1",
          client_type: "claude_custom_connector",
          scopes: ["profile:read"],
        },
      }),
    /Remote MCP principal does not allow tools:read/u,
  );
});

test("remote provider always uses request principal headers instead of process API key", async () => {
  const calls: Array<{ init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    calls.push({ init });

    return jsonResponse({
      data: {
        price: 87500.25,
        ticker: "BTC-USD",
        dayChange: 1200.5,
        dayChangePercent: 1.39,
        volume24h: 28500.75,
        time: "2026-03-30T12:00:00Z",
      },
      meta: { creditsUsed: 1, remainingCredits: 97 },
    });
  }) as typeof fetch;

  try {
    const provider = new LlmquantApiClientProvider(remoteEnv);
    const client = provider.getClient({
      session: {
        user_id: "user-1",
        client_type: "claude_custom_connector",
        mcp_token_id: "mcp-token-1",
        scopes: ["tools:read"],
      },
    });

    await client.getCryptoSnapshot({ ticker: "BTC-USD" });

    const headers = new Headers(calls[0]?.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer internal-secret");
    assert.equal(headers.get("x-llmquant-user-id"), "user-1");
    assert.equal(headers.get("x-llmquant-client-type"), "claude_custom_connector");
    assert.equal(headers.get("x-llmquant-mcp-token-id"), "mcp-token-1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
