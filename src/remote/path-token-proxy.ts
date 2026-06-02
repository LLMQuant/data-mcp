import http from "node:http";
import { createHash } from "node:crypto";

import type { LlmquantEnv } from "../env";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

function safeDecodeComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function rewritePathTokenUrl(url: URL, endpoint: string) {
  const match = /^\/u\/([^/]+)\/mcp$/u.exec(url.pathname);

  if (!match) {
    return null;
  }

  const pathToken = safeDecodeComponent(match[1]!);

  if (!pathToken) {
    return null;
  }

  url.pathname = endpoint;

  return pathToken;
}

function proxyHeaders(
  request: http.IncomingMessage,
  env: LlmquantEnv,
  pathToken: string | null,
) {
  const headers: http.OutgoingHttpHeaders = {
    ...request.headers,
    host: `127.0.0.1:${env.mcpInternalPort}`,
  };

  delete headers["x-llmquant-mcp-token"];

  if (pathToken) {
    headers["x-llmquant-mcp-token"] = pathToken;
  }

  delete headers["content-length"];

  return headers;
}

function headerValue(
  headers: http.IncomingHttpHeaders,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function clientIp(request: http.IncomingMessage) {
  const forwardedFor = headerValue(request.headers, "x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwardedFor || request.socket.remoteAddress || "unknown";
}

function bearerToken(request: http.IncomingMessage) {
  const authorization = headerValue(request.headers, "authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}

function rateLimitKeys(
  request: http.IncomingMessage,
  pathToken: string | null,
) {
  const keys = [`ip:${clientIp(request)}`];
  const userId = headerValue(request.headers, "x-llmquant-user-id")?.trim();

  if (pathToken) {
    keys.push(`token:${hashValue(pathToken)}`);
  } else if (userId) {
    keys.push(`user:${userId}`);
  } else {
    const token = bearerToken(request);

    if (token) {
      keys.push(`bearer:${hashValue(token)}`);
    }
  }

  return [...new Set(keys)];
}

function createRateLimiter(env: LlmquantEnv) {
  const buckets = new Map<string, RateLimitBucket>();
  let lastPrunedAt = 0;

  function pruneExpiredBuckets(now: number) {
    if (now - lastPrunedAt < env.rateLimitWindowMs) {
      return;
    }

    lastPrunedAt = now;

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    check(request: http.IncomingMessage, pathToken: string | null): RateLimitResult {
      const now = Date.now();

      if (env.rateLimitMax === 0) {
        return {
          allowed: true,
          limit: 0,
          remaining: Number.POSITIVE_INFINITY,
          resetAt: now + env.rateLimitWindowMs,
        };
      }

      pruneExpiredBuckets(now);

      const keys = rateLimitKeys(request, pathToken);
      const nextBuckets = keys.map((key) => {
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
          const fresh = { count: 0, resetAt: now + env.rateLimitWindowMs };
          buckets.set(key, fresh);
          return fresh;
        }

        return current;
      });
      const exhausted = nextBuckets.find((bucket) => bucket.count >= env.rateLimitMax);

      if (exhausted) {
        return {
          allowed: false,
          limit: env.rateLimitMax,
          remaining: 0,
          resetAt: exhausted.resetAt,
        };
      }

      for (const bucket of nextBuckets) {
        bucket.count += 1;
      }

      const remaining = Math.max(
        0,
        Math.min(...nextBuckets.map((bucket) => env.rateLimitMax - bucket.count)),
      );
      const resetAt = Math.max(...nextBuckets.map((bucket) => bucket.resetAt));

      return {
        allowed: true,
        limit: env.rateLimitMax,
        remaining,
        resetAt,
      };
    },
  };
}

function writeRateLimitResponse(
  response: http.ServerResponse,
  rateLimit: RateLimitResult,
) {
  const retryAfter = Math.max(
    1,
    Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
  );

  response.writeHead(429, {
    "content-type": "application/json",
    "retry-after": String(retryAfter),
    "x-ratelimit-limit": String(rateLimit.limit),
    "x-ratelimit-remaining": String(rateLimit.remaining),
    "x-ratelimit-reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  });
  response.end(
    JSON.stringify({
      error: "Remote MCP rate limit exceeded.",
    }),
  );
}

function isProbePath(pathname: string) {
  return pathname === "/health" || pathname === "/ready" || pathname === "/ping";
}

function writeProbeResponse(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  pathname: string,
) {
  response.writeHead(200, { "content-type": "application/json" });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(
    JSON.stringify({
      ok: true,
      status: pathname === "/ready" ? "ready" : "ok",
    }),
  );
}

export function startPathTokenProxy(env: LlmquantEnv) {
  const rateLimiter = createRateLimiter(env);

  const server = http.createServer((request, response) => {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );
    const pathToken = rewritePathTokenUrl(url, env.mcpEndpoint);

    if (
      (request.method === "GET" || request.method === "HEAD") &&
      isProbePath(url.pathname)
    ) {
      writeProbeResponse(request, response, url.pathname);
      return;
    }

    const publicPaths: string[] = [env.mcpEndpoint];

    if (!pathToken && !publicPaths.includes(url.pathname)) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found." }));
      return;
    }

    const rateLimit = rateLimiter.check(request, pathToken);

    if (!rateLimit.allowed) {
      writeRateLimitResponse(response, rateLimit);
      return;
    }

    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: env.mcpInternalPort,
        method: request.method,
        path: `${url.pathname}${url.search}`,
        headers: proxyHeaders(request, env, pathToken),
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 500,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );

    upstream.on("error", (error) => {
      console.error("[remote-mcp] upstream request failed:", error);
      response.writeHead(502, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: "Remote MCP service is temporarily unavailable.",
        }),
      );
    });

    request.pipe(upstream);
  });

  server.listen(env.mcpPort, env.mcpHost, () => {
    console.error(
      `LLMQuant Remote MCP proxy listening on http://${env.mcpHost}:${env.mcpPort}`,
    );
  });

  return server;
}
