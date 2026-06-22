import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import { after, test } from "node:test";
import { createMCPClient as createAiSdkMcpClient } from "@ai-sdk/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import type { LlmquantEnv } from "../env";
import { createServer as createMcpServer } from "../server";
import { startPathTokenProxy } from "./path-token-proxy";

interface CapturedRequest {
  body?: unknown;
  headers: http.IncomingHttpHeaders;
  method?: string;
  url?: string;
}

interface AiSdkToolResult {
  content?: Array<{ text?: string; type: string }>;
  isError?: boolean;
}

interface AiSdkTool {
  execute: (
    args: Record<string, unknown>,
    options?: { abortSignal?: AbortSignal },
  ) => Promise<AiSdkToolResult>;
}

const activeServers: Array<{ close: () => Promise<void> }> = [];

after(async () => {
  await Promise.all(activeServers.map((server) => server.close()));
});

function listen(server: http.Server, port: number) {
  return new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });
}

function close(server: http.Server | net.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getAvailablePort() {
  const server = net.createServer();

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;

  await close(server);
  return port;
}

function createFakeWebApi({
  dataRequests,
  principalRequests,
}: {
  dataRequests: CapturedRequest[];
  principalRequests?: CapturedRequest[];
}) {
  return http.createServer((request, response) => {
    if (request.method === "POST" && request.url === "/api/mcp/principal") {
      let body = "";

      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        const payload = JSON.parse(body) as { token?: string };
        principalRequests?.push({
          body: payload,
          headers: request.headers,
          method: request.method,
          url: request.url,
        });

        if (payload.token === "revoked-token") {
          response.writeHead(401, { "content-type": "application/json" });
          response.end(JSON.stringify({ error: "Invalid MCP token." }));
          return;
        }

        const scopes =
          payload.token === "no-tools-read-token"
            ? ["profile:read"]
            : ["tools:read"];

        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            principal: {
              user_id: "token-user",
              scopes,
              client_type: "claude_custom_connector",
              mcp_token_id: "mcp-token-id",
              credit_account: { type: "user", user_id: "token-user" },
            },
          }),
        );
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/wiki/search") {
      let body = "";

      request.on("data", (chunk) => {
        body += String(chunk);
      });
      request.on("end", () => {
        const payload = JSON.parse(body) as { query?: string; topK?: number };
        dataRequests.push({
          body: payload,
          headers: request.headers,
          method: request.method,
          url: request.url,
        });

        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            data: [
              {
                wiki_item_id: "wiki-local-smoke",
                slug: "remote-mcp-local-smoke",
                title: "Remote MCP Local Smoke",
                summary: "A fake wiki item returned by the Web API.",
                tags: ["smoke"],
                semantic_score: 0.91,
                lexical_score: 0.42,
                combined_score: 0.76,
              },
            ],
            meta: {
              topK: payload.topK ?? 1,
              creditsUsed: 1,
              remainingCredits: 99,
            },
          }),
        );
      });
      return;
    }

    dataRequests.push({
      headers: request.headers,
      method: request.method,
      url: request.url,
    });

    if (
      request.method === "GET" &&
      request.url?.startsWith("/api/wiki/items/")
    ) {
      if (request.url.includes("no-credit")) {
        response.writeHead(402, { "content-type": "application/json" });
        // Unified error envelope (response-contract.md §五): { error: { code, message } }.
        response.end(
          JSON.stringify({
            error: { code: "insufficient_credits", message: "Insufficient credits." },
          }),
        );
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          data: {
            wiki_item_id: "wiki-item-1",
            slug: "remote-mcp-smoke",
            title: "Remote MCP Smoke",
            summary: "A fake wiki item returned by the Web API.",
            body_markdown: "Remote MCP body.",
            tags: ["smoke"],
            aliases: [],
            related_concepts: [],
            source_updated_at: null,
            created_at: "2026-05-13T00:00:00Z",
            updated_at: "2026-05-13T00:00:00Z",
          },
          meta: {
            creditsUsed: 0,
            remainingCredits: 99,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found." }));
  });
}

async function postMcpInitialize(url: string, headers?: Record<string, string>) {
  return fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        capabilities: {},
        clientInfo: { name: "llmquant-remote-transport-test", version: "0.0.0" },
        protocolVersion: "2024-11-05",
      },
    }),
  });
}

async function createMcpClient({
  headers,
  url,
}: {
  headers?: Record<string, string>;
  url: string;
}) {
  const client = new Client({
    name: "llmquant-remote-transport-test",
    version: "0.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: headers ? { headers } : undefined,
  });

  await client.connect(transport);
  return client;
}

async function createAiSdkMcpHttpClient({
  headers,
  url,
}: {
  headers?: Record<string, string>;
  url: string;
}) {
  return createAiSdkMcpClient({
    transport: {
      type: "http",
      url,
      headers,
      redirect: "error",
    },
    clientName: "llmquant-ai-sdk-local-smoke",
    version: "0.0.0",
  });
}

async function callAiSdkWikiSearch(
  tools: Record<string, unknown>,
): Promise<{ meta?: { remainingCredits?: number }; summary?: string }> {
  const wikiSearch = tools.wiki_search as AiSdkTool | undefined;
  assert.ok(wikiSearch?.execute);

  const result = await wikiSearch.execute(
    { query: "risk parity", topK: 1 },
    {},
  );
  assert.notEqual(result.isError, true);

  const text = result.content?.find((block) => block.type === "text")?.text;
  assert.ok(text);

  return JSON.parse(text) as {
    meta?: { remainingCredits?: number };
    summary?: string;
  };
}

function remoteEnv({
  apiPort,
  internalMcpPort,
  mcpPort,
}: {
  apiPort: number;
  internalMcpPort: number;
  mcpPort: number;
}): LlmquantEnv {
  return {
    baseUrl: `http://127.0.0.1:${apiPort}`,
    timeoutMs: 5_000,
    transport: "httpStream",
    internalApiSecret: "internal-secret",
    mcpHost: "127.0.0.1",
    mcpPort,
    mcpInternalPort: internalMcpPort,
    mcpEndpoint: "/mcp",
    enablePathTokenProxy: false,
    allowedOrigins: [],
    rateLimitWindowMs: 60_000,
    rateLimitMax: 120,
  };
}

test("httpStream path-token proxy serves deployment probe endpoints directly", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  for (const pathname of ["/health", "/ready", "/ping"]) {
    const response = await fetch(`http://127.0.0.1:${publicMcpPort}${pathname}`);
    const payload = (await response.json()) as {
      ok?: boolean;
      status?: string;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.status, pathname === "/ready" ? "ready" : "ok");
  }

  const headResponse = await fetch(`http://127.0.0.1:${publicMcpPort}/ready`, {
    method: "HEAD",
  });

  assert.equal(headResponse.status, 200);
  assert.equal(await headResponse.text(), "");
});

test("httpStream path-token proxy rejects malformed token encoding without crashing", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const response = await fetch(
    `http://127.0.0.1:${publicMcpPort}/u/%E0%A4%A/mcp`,
  );
  const payload = (await response.json()) as { error?: string };

  assert.equal(response.status, 404);
  assert.equal(payload.error, "Not found.");

  const healthResponse = await fetch(
    `http://127.0.0.1:${publicMcpPort}/health`,
  );

  assert.equal(healthResponse.status, 200);
});

test("httpStream path-token proxy hides internal transport errors from callers", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
    rateLimitMax: 0,
  };
  const originalConsoleError = console.error;

  console.error = () => {};
  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  try {
    const response = await fetch(`http://127.0.0.1:${publicMcpPort}/mcp`);
    const payload = (await response.json()) as { error?: string };

    assert.equal(response.status, 502);
    assert.equal(payload.error, "Remote MCP service is temporarily unavailable.");
    assert.doesNotMatch(payload.error ?? "", /ECONNREFUSED|127\.0\.0\.1/i);
  } finally {
    console.error = originalConsoleError;
  }
});

test("httpStream path-token proxy rate-limits public MCP traffic", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
    rateLimitWindowMs: 60_000,
    rateLimitMax: 1,
  };

  const mcpServer = createMcpServer(env);
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const firstResponse = await postMcpInitialize(
    `http://127.0.0.1:${publicMcpPort}/mcp`,
  );
  const secondResponse = await postMcpInitialize(
    `http://127.0.0.1:${publicMcpPort}/mcp`,
  );
  const payload = (await secondResponse.json()) as { error?: string };

  assert.equal(firstResponse.status, 401);
  assert.equal(secondResponse.status, 429);
  assert.equal(payload.error, "Remote MCP rate limit exceeded.");
  assert.equal(secondResponse.headers.get("x-ratelimit-limit"), "1");
  assert.equal(secondResponse.headers.get("x-ratelimit-remaining"), "0");

  const probeResponse = await fetch(`http://127.0.0.1:${publicMcpPort}/health`);
  assert.equal(probeResponse.status, 200);
});

test("httpStream first-party bearer calls Web API with request principal", async () => {
  const [apiPort, mcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const mcpServer = createMcpServer(
    remoteEnv({ apiPort, internalMcpPort: mcpPort + 1, mcpPort }),
  );
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: mcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const client = await createMcpClient({
    url: `http://127.0.0.1:${mcpPort}/mcp`,
    headers: {
      authorization: "Bearer internal-secret",
      "x-llmquant-user-id": "first-party-user",
      "x-llmquant-client-type": "vercel_agent",
    },
  });

  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "wiki_read"));

    const result = await client.callTool({
      name: "wiki_read",
      arguments: { wikiItemId: "wiki-item-1", maxLength: 50 },
    });

    assert.match(JSON.stringify(result), /Remote MCP Smoke/u);
    assert.equal(dataRequests.length, 1);
    assert.equal(dataRequests[0]?.headers.authorization, "Bearer internal-secret");
    assert.equal(dataRequests[0]?.headers["x-llmquant-user-id"], "first-party-user");
    assert.equal(dataRequests[0]?.headers["x-llmquant-client-type"], "vercel_agent");
  } finally {
    await client.close();
  }
});

test("httpStream missing authentication returns a structured JSON-RPC error", async () => {
  const [apiPort, mcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const mcpServer = createMcpServer(
    remoteEnv({ apiPort, internalMcpPort: mcpPort + 1, mcpPort }),
  );
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: mcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const response = await postMcpInitialize(`http://127.0.0.1:${mcpPort}/mcp`);
  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    jsonrpc?: string;
  };

  assert.equal(response.status, 401);
  assert.equal(payload.jsonrpc, "2.0");
  assert.equal(payload.error?.code, -32000);
  assert.equal(payload.error?.message, "Missing MCP authentication.");
  assert.equal(dataRequests.length, 0);
});

test("httpStream path-token proxy resolves principal before Web API calls", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const principalRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests, principalRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };
  const mcpServer = createMcpServer(env);
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const client = await createMcpClient({
    url: `http://127.0.0.1:${publicMcpPort}/u/lqd_mcp_smoke_secret/mcp`,
  });

  try {
    const result = await client.callTool({
      name: "wiki_read",
      arguments: { wikiItemId: "wiki-item-1", maxLength: 50 },
    });

    assert.match(JSON.stringify(result), /Remote MCP Smoke/u);
    assert.ok(principalRequests.length > 0);
    assert.equal(
      principalRequests[0]?.headers.authorization,
      "Bearer internal-secret",
    );
    assert.deepEqual(principalRequests[0]?.body, {
      token: "lqd_mcp_smoke_secret",
    });
    assert.equal(dataRequests.length, 1);
    assert.equal(dataRequests[0]?.headers.authorization, "Bearer internal-secret");
    assert.equal(dataRequests[0]?.headers["x-llmquant-user-id"], "token-user");
    assert.equal(
      dataRequests[0]?.headers["x-llmquant-client-type"],
      "claude_custom_connector",
    );
    assert.equal(dataRequests[0]?.headers["x-llmquant-mcp-token-id"], "mcp-token-id");
  } finally {
    await client.close();
  }
});

test("httpStream works with Vercel AI SDK MCP http client for bearer and path tokens", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const principalRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests, principalRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };
  // Enable the gated news_browse tool so the listing reflects the full tool set.
  const previousNewsApiEnabled = process.env.NEWS_API_ENABLED;
  process.env.NEWS_API_ENABLED = "true";
  const mcpServer = createMcpServer(env);
  if (previousNewsApiEnabled === undefined) {
    delete process.env.NEWS_API_ENABLED;
  } else {
    process.env.NEWS_API_ENABLED = previousNewsApiEnabled;
  }
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const firstPartyClient = await createAiSdkMcpHttpClient({
    url: `http://127.0.0.1:${publicMcpPort}/mcp`,
    headers: {
      authorization: "Bearer internal-secret",
      "x-llmquant-user-id": "first-party-user",
      "x-llmquant-client-type": "vercel_agent",
    },
  });
  const pathTokenClient = await createAiSdkMcpHttpClient({
    url: `http://127.0.0.1:${publicMcpPort}/u/lqd_mcp_ai_sdk_secret/mcp`,
  });

  try {
    const firstPartyTools = await firstPartyClient.tools();
    const pathTokenTools = await pathTokenClient.tools();

    assert.equal(Object.keys(firstPartyTools).length, 26);
    assert.equal(Object.keys(pathTokenTools).length, 26);

    const firstPartyResult = await callAiSdkWikiSearch(firstPartyTools);
    const pathTokenResult = await callAiSdkWikiSearch(pathTokenTools);

    assert.match(firstPartyResult.summary ?? "", /Found 1 wiki result/u);
    assert.match(pathTokenResult.summary ?? "", /Found 1 wiki result/u);
    assert.equal(firstPartyResult.meta?.remainingCredits, 99);
    assert.equal(pathTokenResult.meta?.remainingCredits, 99);

    assert.equal(dataRequests.length, 2);
    assert.equal(dataRequests[0]?.headers["x-llmquant-user-id"], "first-party-user");
    assert.equal(dataRequests[0]?.headers["x-llmquant-client-type"], "vercel_agent");
    assert.equal(dataRequests[1]?.headers["x-llmquant-user-id"], "token-user");
    assert.equal(
      dataRequests[1]?.headers["x-llmquant-client-type"],
      "claude_custom_connector",
    );
    assert.equal(dataRequests[1]?.headers["x-llmquant-mcp-token-id"], "mcp-token-id");
    assert.ok(principalRequests.length > 0);
    assert.ok(
      principalRequests.every(
        (request) =>
          (request.body as { token?: string } | undefined)?.token ===
          "lqd_mcp_ai_sdk_secret",
      ),
    );
  } finally {
    await Promise.all([
      firstPartyClient.close(),
      pathTokenClient.close(),
    ]);
  }
});

test("httpStream path-token proxy ignores caller-supplied token headers on /mcp", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const principalRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests, principalRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };
  const mcpServer = createMcpServer(env);
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const response = await postMcpInitialize(`http://127.0.0.1:${publicMcpPort}/mcp`, {
    "x-llmquant-mcp-token": "lqd_mcp_header_should_not_work",
  });
  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    jsonrpc?: string;
  };

  assert.equal(response.status, 401);
  assert.equal(payload.jsonrpc, "2.0");
  assert.equal(payload.error?.code, -32000);
  assert.equal(payload.error?.message, "Missing MCP authentication.");
  assert.equal(principalRequests.length, 0);
  assert.equal(dataRequests.length, 0);
});

test("httpStream path-token proxy rejects revoked tokens before tool execution", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const principalRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests, principalRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };
  const mcpServer = createMcpServer(env);
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const response = await postMcpInitialize(
    `http://127.0.0.1:${publicMcpPort}/u/revoked-token/mcp`,
  );
  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    jsonrpc?: string;
  };

  assert.equal(response.status, 401);
  assert.equal(payload.jsonrpc, "2.0");
  assert.equal(payload.error?.code, -32000);
  assert.equal(payload.error?.message, "Invalid MCP token.");
  assert.deepEqual(principalRequests[0]?.body, { token: "revoked-token" });
  assert.equal(dataRequests.length, 0);
});

test("httpStream path-token proxy rejects principals without tools:read before Web API calls", async () => {
  const [apiPort, publicMcpPort, internalMcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const principalRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests, principalRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const env = {
    ...remoteEnv({
      apiPort,
      internalMcpPort,
      mcpPort: publicMcpPort,
    }),
    enablePathTokenProxy: true,
  };
  const mcpServer = createMcpServer(env);
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: internalMcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const proxyServer = startPathTokenProxy(env);
  await new Promise<void>((resolve) => proxyServer.once("listening", resolve));
  activeServers.push({ close: () => close(proxyServer) });

  const client = await createMcpClient({
    url: `http://127.0.0.1:${publicMcpPort}/u/no-tools-read-token/mcp`,
  });

  try {
    const result = await client.callTool({
      name: "wiki_read",
      arguments: { wikiItemId: "wiki-item-1", maxLength: 50 },
    });

    assert.equal(result.isError, true);
    assert.match(
      JSON.stringify(result.content),
      /Remote MCP connector is not authorized to use tools/u,
    );
    assert.deepEqual(principalRequests[0]?.body, {
      token: "no-tools-read-token",
    });
    assert.equal(dataRequests.length, 0);
  } finally {
    await client.close();
  }
});

test("httpStream tool failures return structured MCP errors", async () => {
  const [apiPort, mcpPort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
  ]);
  const dataRequests: CapturedRequest[] = [];
  const apiServer = createFakeWebApi({ dataRequests });
  await listen(apiServer, apiPort);
  activeServers.push({ close: () => close(apiServer) });

  const mcpServer = createMcpServer(
    remoteEnv({ apiPort, internalMcpPort: mcpPort + 1, mcpPort }),
  );
  await mcpServer.start({
    transportType: "httpStream",
    httpStream: {
      endpoint: "/mcp",
      host: "127.0.0.1",
      port: mcpPort,
      stateless: true,
    },
  });
  activeServers.push({ close: () => mcpServer.stop() });

  const client = await createMcpClient({
    url: `http://127.0.0.1:${mcpPort}/mcp`,
    headers: {
      authorization: "Bearer internal-secret",
      "x-llmquant-user-id": "first-party-user",
      "x-llmquant-client-type": "vercel_agent",
    },
  });

  try {
    const result = await client.callTool({
      name: "wiki_read",
      arguments: { wikiItemId: "no-credit", maxLength: 50 },
    });

    assert.equal(result.isError, true);
    // MCP forwards Web's sanitized error message verbatim (no appended status).
    assert.match(JSON.stringify(result.content), /Insufficient credits/u);
    assert.doesNotMatch(JSON.stringify(result.content), /status 402/u);
  } finally {
    await client.close();
  }
});
