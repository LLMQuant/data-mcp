import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.llmquantdata.com";
const DEFAULT_TIMEOUT_MS = 15_000;

const envSchema = z.object({
  LLMQUANT_API_KEY: z
    .string()
    .trim()
    .min(1, "LLMQUANT_API_KEY is required."),
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

export interface LlmquantEnv {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
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

export function getEnv(): LlmquantEnv {
  loadEnvFiles();
  const parsed = envSchema.parse(process.env);

  return {
    apiKey: parsed.LLMQUANT_API_KEY,
    baseUrl: stripTrailingSlash(parsed.LLMQUANT_BASE_URL),
    timeoutMs: parsed.LLMQUANT_API_TIMEOUT_MS,
  };
}
