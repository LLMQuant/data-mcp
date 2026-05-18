import type { IncomingHttpHeaders, IncomingMessage } from "node:http";

import type { LlmquantEnv } from "../env";

export interface LlmquantMcpPrincipal {
  user_id: string;
  scopes: string[];
  client_type: string;
  mcp_token_id?: string;
  credit_account: {
    type: "user";
    user_id: string;
  };
}

export interface LlmquantMcpAuth
  extends LlmquantMcpPrincipal,
    Record<string, unknown> {
  authenticated: true;
}

interface PrincipalResponse {
  principal?: Record<string, unknown>;
  error?: string;
}

export function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function bearerToken(headers: IncomingHttpHeaders) {
  const authorization = headerValue(headers, "authorization");

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorization.slice(7).trim();
}

function validateOrigin(env: LlmquantEnv, request: IncomingMessage) {
  if (env.allowedOrigins.length === 0) {
    return true;
  }

  const origin = headerValue(request.headers, "origin");

  if (!origin) {
    return true;
  }

  return env.allowedOrigins.includes(origin);
}

async function resolveUrlToken(env: LlmquantEnv, token: string) {
  const response = await fetch(new URL("/api/mcp/principal", env.baseUrl), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.internalApiSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ token }),
    signal: AbortSignal.timeout(env.timeoutMs),
  });

  const payload = (await response.json().catch(() => ({}))) as PrincipalResponse;

  if (!response.ok || !payload.principal) {
    return null;
  }

  return normalizePrincipal(payload.principal);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizePrincipal(
  principal: Record<string, unknown>,
): LlmquantMcpPrincipal | null {
  const userId =
    optionalString(principal.user_id) ?? optionalString(principal.userId);
  const clientType =
    optionalString(principal.client_type) ?? optionalString(principal.clientType);
  const scopes = Array.isArray(principal.scopes)
    ? principal.scopes.filter((scope): scope is string => typeof scope === "string")
    : [];

  if (!userId || !clientType || scopes.length === 0) {
    return null;
  }

  return {
    user_id: userId,
    scopes,
    client_type: clientType,
    mcp_token_id:
      optionalString(principal.mcp_token_id) ??
      optionalString(principal.mcpTokenId),
    credit_account: {
      type: "user",
      user_id: userId,
    },
  };
}

export async function resolvePrincipal(
  env: LlmquantEnv,
  request: IncomingMessage | undefined,
): Promise<LlmquantMcpAuth | { authenticated: false; error: string }> {
  if (!request) {
    return { authenticated: false, error: "Remote MCP requires HTTP." };
  }

  if (!validateOrigin(env, request)) {
    return { authenticated: false, error: "Origin is not allowed." };
  }

  const pathToken = headerValue(request.headers, "x-llmquant-mcp-token");

  if (pathToken && env.enablePathTokenProxy) {
    const principal = await resolveUrlToken(env, pathToken);

    if (!principal) {
      return { authenticated: false, error: "Invalid MCP token." };
    }

    return { ...principal, authenticated: true };
  }

  if (bearerToken(request.headers) === env.internalApiSecret) {
    const userId = headerValue(request.headers, "x-llmquant-user-id")?.trim();
    const clientType =
      headerValue(request.headers, "x-llmquant-client-type")?.trim() ||
      "vercel_agent";

    if (!userId) {
      return {
        authenticated: false,
        error: "Invalid MCP authentication.",
      };
    }

    return {
      authenticated: true,
      user_id: userId,
      scopes: ["tools:read"],
      client_type: clientType,
      credit_account: {
        type: "user",
        user_id: userId,
      },
    };
  }

  return { authenticated: false, error: "Missing MCP authentication." };
}
