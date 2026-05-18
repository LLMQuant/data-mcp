import type { LlmquantEnv } from "../env";
import { LlmquantWebApiClient } from "./web-api";

export type ApiClientProvider = LlmquantWebApiClient | LlmquantApiClientProvider;

function getSession(context?: unknown) {
  if (!context || typeof context !== "object" || !("session" in context)) {
    return undefined;
  }

  const session = context.session;

  if (!session || typeof session !== "object") {
    return undefined;
  }

  return session as Record<string, unknown>;
}

function sessionString(
  session: Record<string, unknown>,
  key: string,
  legacyKey?: string,
) {
  const value = session[key] ?? (legacyKey ? session[legacyKey] : undefined);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function sessionScopes(session: Record<string, unknown>) {
  const value = session.scopes;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((scope): scope is string => typeof scope === "string");
}

export class LlmquantApiClientProvider {
  constructor(private readonly env: LlmquantEnv) {}

  getClient(context?: unknown) {
    const session = getSession(context);

    if (session) {
      const userId = sessionString(session, "user_id", "userId");
      const clientType =
        sessionString(session, "client_type", "clientType") ?? "remote_mcp";
      const mcpTokenId = sessionString(session, "mcp_token_id", "mcpTokenId");

      if (!userId) {
        if (this.env.transport === "httpStream") {
          throw new Error("Remote MCP request is missing authenticated principal.");
        }

        return new LlmquantWebApiClient(this.env);
      }

      if (
        this.env.transport === "httpStream" &&
        !sessionScopes(session).includes("tools:read")
      ) {
        throw new Error("Remote MCP principal does not allow tools:read.");
      }

      return new LlmquantWebApiClient({
        baseUrl: this.env.baseUrl,
        timeoutMs: this.env.timeoutMs,
        internalAuth: {
          secret: this.env.internalApiSecret ?? "",
          userId,
          clientType,
          mcpTokenId,
        },
      });
    }

    if (this.env.transport === "httpStream") {
      throw new Error("Remote MCP request is missing authenticated principal.");
    }

    return new LlmquantWebApiClient(this.env);
  }
}

export function getApiClient(
  provider: ApiClientProvider,
  context?: unknown,
) {
  if (provider instanceof LlmquantWebApiClient) {
    return provider;
  }

  if (
    provider &&
    typeof provider === "object" &&
    "getClient" in provider &&
    typeof provider.getClient === "function"
  ) {
    return provider.getClient(context);
  }

  return provider as unknown as LlmquantWebApiClient;
}
