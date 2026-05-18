import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.llmquantdata.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MCP_PORT = 8080;
const DEFAULT_MCP_HOST = "::";
const DEFAULT_MCP_ENDPOINT = "/mcp";
const DEFAULT_MCP_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MCP_RATE_LIMIT_MAX = 120;

function portSchema(name: string) {
  return z.coerce
    .number()
    .int()
    .positive(`${name} must be a positive integer.`)
    .max(65_535, `${name} must be 65535 or less.`);
}

const commonEnvSchema = z.object({
  LLMQUANT_BASE_URL: z
    .string()
    .trim()
    .url("LLMQUANT_BASE_URL must be a valid URL.")
    .default(DEFAULT_BASE_URL),
  LLMQUANT_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive("LLMQUANT_API_TIMEOUT_MS must be a positive integer.")
    .max(120_000, "LLMQUANT_API_TIMEOUT_MS must be 120000 or less.")
    .default(DEFAULT_TIMEOUT_MS),
});

const stdioEnvSchema = commonEnvSchema.extend({
  LLMQUANT_API_KEY: z
    .string()
    .trim()
    .min(1, "LLMQUANT_API_KEY is required."),
});

const httpStreamEnvSchema = commonEnvSchema.extend({
  LLMQUANT_API_KEY: z.string().trim().optional(),
  LLMQUANT_INTERNAL_API_SECRET: z
    .string()
    .trim()
    .min(1, "LLMQUANT_INTERNAL_API_SECRET is required for httpStream."),
  LLMQUANT_MCP_HOST: z.string().trim().default(DEFAULT_MCP_HOST),
  PORT: portSchema("PORT").optional(),
  LLMQUANT_MCP_PORT: portSchema("LLMQUANT_MCP_PORT").optional(),
  LLMQUANT_MCP_INTERNAL_PORT: portSchema("LLMQUANT_MCP_INTERNAL_PORT").optional(),
  LLMQUANT_MCP_ENDPOINT: z
    .string()
    .trim()
    .regex(/^\/\S*$/u, "LLMQUANT_MCP_ENDPOINT must start with '/'.")
    .default(DEFAULT_MCP_ENDPOINT),
  LLMQUANT_MCP_ENABLE_PATH_TOKEN_PROXY: z
    .enum(["true", "false"])
    .default("true"),
  LLMQUANT_MCP_ALLOWED_ORIGINS: z.string().trim().optional(),
  LLMQUANT_MCP_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive("LLMQUANT_MCP_RATE_LIMIT_WINDOW_MS must be a positive integer.")
    .max(
      3_600_000,
      "LLMQUANT_MCP_RATE_LIMIT_WINDOW_MS must be 3600000 or less.",
    )
    .default(DEFAULT_MCP_RATE_LIMIT_WINDOW_MS),
  LLMQUANT_MCP_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .min(0, "LLMQUANT_MCP_RATE_LIMIT_MAX must be 0 or greater.")
    .max(10_000, "LLMQUANT_MCP_RATE_LIMIT_MAX must be 10000 or less.")
    .default(DEFAULT_MCP_RATE_LIMIT_MAX),
});

export type LlmquantTransport = "stdio" | "httpStream";

export interface LlmquantEnv {
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  transport: LlmquantTransport;
  internalApiSecret?: string;
  mcpHost: string;
  mcpPort: number;
  mcpInternalPort: number;
  mcpEndpoint: `/${string}`;
  enablePathTokenProxy: boolean;
  allowedOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function stripInlineComment(value: string) {
  if (value.startsWith('"') || value.startsWith("'")) {
    return value;
  }

  const commentIndex = value.search(/\s#/u);

  if (commentIndex === -1) {
    return value;
  }

  return value.slice(0, commentIndex).trimEnd();
}

export function parseDotenv(source: string) {
  const values: Record<string, string> = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = stripInlineComment(
      normalized.slice(separatorIndex + 1).trim()
    );

    if (!key) {
      continue;
    }

    values[key] = unquote(value);
  }

  return values;
}

export function collectEnvFileValues(cwd = process.cwd()) {
  const parent = dirname(cwd);
  const candidates = [
    join(parent, ".env"),
    join(parent, ".env.local"),
    join(cwd, ".env"),
    join(cwd, ".env.local"),
  ];
  const merged: Record<string, string> = {};

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    Object.assign(merged, parseDotenv(readFileSync(candidate, "utf8")));
  }

  return merged;
}

export function loadEnvFiles(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()) {
  const fileValues = collectEnvFileValues(cwd);

  for (const [key, value] of Object.entries(fileValues)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  return env;
}

function stripTrailingSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function parseTransport(argv = process.argv.slice(2)): LlmquantTransport {
  const transportArg = argv.find((arg) => arg.startsWith("--transport="));
  const transport = transportArg
    ? transportArg.slice("--transport=".length)
    : process.env.LLMQUANT_MCP_TRANSPORT;

  if (transport === "httpStream" || transport === "stdio") {
    return transport;
  }

  return "stdio";
}

function parseAllowedOrigins(value?: string) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getEnv(argv = process.argv.slice(2)): LlmquantEnv {
  loadEnvFiles();
  const transport = parseTransport(argv);

  if (transport === "httpStream") {
    const parsed = httpStreamEnvSchema.parse(process.env);
    const mcpPort =
      parsed.LLMQUANT_MCP_PORT ?? parsed.PORT ?? DEFAULT_MCP_PORT;

    return {
      apiKey: parsed.LLMQUANT_API_KEY,
      baseUrl: stripTrailingSlash(parsed.LLMQUANT_BASE_URL),
      timeoutMs: parsed.LLMQUANT_API_TIMEOUT_MS,
      transport,
      internalApiSecret: parsed.LLMQUANT_INTERNAL_API_SECRET,
      mcpHost: parsed.LLMQUANT_MCP_HOST,
      mcpPort,
      mcpInternalPort: parsed.LLMQUANT_MCP_INTERNAL_PORT ?? mcpPort + 1,
      mcpEndpoint: parsed.LLMQUANT_MCP_ENDPOINT as `/${string}`,
      enablePathTokenProxy:
        parsed.LLMQUANT_MCP_ENABLE_PATH_TOKEN_PROXY !== "false",
      allowedOrigins: parseAllowedOrigins(parsed.LLMQUANT_MCP_ALLOWED_ORIGINS),
      rateLimitWindowMs: parsed.LLMQUANT_MCP_RATE_LIMIT_WINDOW_MS,
      rateLimitMax: parsed.LLMQUANT_MCP_RATE_LIMIT_MAX,
    };
  }

  const parsed = stdioEnvSchema.parse(process.env);

  return {
    apiKey: parsed.LLMQUANT_API_KEY,
    baseUrl: stripTrailingSlash(parsed.LLMQUANT_BASE_URL),
    timeoutMs: parsed.LLMQUANT_API_TIMEOUT_MS,
    transport,
    mcpHost: DEFAULT_MCP_HOST,
    mcpPort: DEFAULT_MCP_PORT,
    mcpInternalPort: DEFAULT_MCP_PORT + 1,
    mcpEndpoint: DEFAULT_MCP_ENDPOINT,
    enablePathTokenProxy: false,
    allowedOrigins: [],
    rateLimitWindowMs: DEFAULT_MCP_RATE_LIMIT_WINDOW_MS,
    rateLimitMax: DEFAULT_MCP_RATE_LIMIT_MAX,
  };
}
