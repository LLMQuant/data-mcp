import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";

import type { LlmquantEnv } from "../env";
import { resolvePrincipal } from "./principal";

const env: LlmquantEnv = {
  baseUrl: "https://api.llmquantdata.test",
  timeoutMs: 1_500,
  transport: "httpStream",
  internalApiSecret: "internal-secret",
  mcpHost: "::",
  mcpPort: 8080,
  mcpInternalPort: 8081,
  mcpEndpoint: "/mcp",
  enablePathTokenProxy: true,
  allowedOrigins: ["https://llmquantdata.com"],
  rateLimitWindowMs: 60_000,
  rateLimitMax: 120,
};

function request(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

test("resolvePrincipal accepts first-party internal bearer with user id", async () => {
  const principal = await resolvePrincipal(
    env,
    request({
      authorization: "Bearer internal-secret",
      "x-llmquant-user-id": "u1",
      "x-llmquant-client-type": "vercel_agent",
      origin: "https://llmquantdata.com",
    }),
  );

  assert.equal(principal.authenticated, true);

  if (principal.authenticated) {
    assert.equal(principal.user_id, "u1");
    assert.deepEqual(principal.scopes, ["tools:read"]);
    assert.equal(principal.client_type, "vercel_agent");
    assert.deepEqual(principal.credit_account, {
      type: "user",
      user_id: "u1",
    });
  }
});

test("resolvePrincipal rejects first-party bearer without user id", async () => {
  const principal = await resolvePrincipal(
    env,
    request({
      authorization: "Bearer internal-secret",
      origin: "https://llmquantdata.com",
    }),
  );

  assert.deepEqual(principal, {
    authenticated: false,
    error: "Invalid MCP authentication.",
  });
});

test("resolvePrincipal rejects disallowed origins", async () => {
  const principal = await resolvePrincipal(
    env,
    request({
      authorization: "Bearer internal-secret",
      "x-llmquant-user-id": "u1",
      origin: "https://evil.example",
    }),
  );

  assert.equal(principal.authenticated, false);
});

test("resolvePrincipal rejects path-token requests from disallowed origins before Web API lookup", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("principal endpoint should not be called");
  }) as typeof fetch;

  try {
    const principal = await resolvePrincipal(
      env,
      request({
        "x-llmquant-mcp-token": "lqd_mcp_test_secret",
        origin: "https://evil.example",
      }),
    );

    assert.deepEqual(principal, {
      authenticated: false,
      error: "Origin is not allowed.",
    });
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolvePrincipal resolves URL tokens through the Web API", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer internal-secret");

    return new Response(
      JSON.stringify({
        principal: {
          user_id: "u2",
          scopes: ["tools:read"],
          client_type: "claude_custom_connector",
          mcp_token_id: "mt1",
          credit_account: { type: "user", user_id: "u2" },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const principal = await resolvePrincipal(
      { ...env, allowedOrigins: [] },
      request({ "x-llmquant-mcp-token": "lqd_mcp_test_secret" }),
    );

    assert.equal(principal.authenticated, true);

    if (principal.authenticated) {
      assert.equal(principal.user_id, "u2");
      assert.deepEqual(principal.scopes, ["tools:read"]);
      assert.equal(principal.client_type, "claude_custom_connector");
      assert.equal(principal.mcp_token_id, "mt1");
      assert.deepEqual(principal.credit_account, {
        type: "user",
        user_id: "u2",
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolvePrincipal ignores URL token headers when the path-token proxy is disabled", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("principal endpoint should not be called");
  }) as typeof fetch;

  try {
    const principal = await resolvePrincipal(
      { ...env, allowedOrigins: [], enablePathTokenProxy: false },
      request({ "x-llmquant-mcp-token": "lqd_mcp_test_secret" }),
    );

    assert.deepEqual(principal, {
      authenticated: false,
      error: "Missing MCP authentication.",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
