import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectEnvFileValues, getEnv, loadEnvFiles, parseDotenv } from "./env";

test("parseDotenv supports comments, export, and quoted values", () => {
  const values = parseDotenv(`
# comment
export LLMQUANT_API_KEY=test_key
LLMQUANT_BASE_URL="http://localhost:3000"
LLMQUANT_API_TIMEOUT_MS='20000'
LLMQUANT_EXTRA_TIMEOUT=30000 # local override
LLMQUANT_URL_WITH_FRAGMENT=https://example.com/path#hash
`);

  assert.deepEqual(values, {
    LLMQUANT_API_KEY: "test_key",
    LLMQUANT_BASE_URL: "http://localhost:3000",
    LLMQUANT_API_TIMEOUT_MS: "20000",
    LLMQUANT_EXTRA_TIMEOUT: "30000",
    LLMQUANT_URL_WITH_FRAGMENT: "https://example.com/path#hash",
  });
});

test("collectEnvFileValues prefers package .env.local over parent .env", () => {
  const root = mkdtempSync(join(tmpdir(), "llmquant-mcp-env-"));
  const packageDir = join(root, "llmquant-data-mcp");
  mkdirSync(packageDir);

  writeFileSync(
    join(root, ".env"),
    "LLMQUANT_API_KEY=root_key\nLLMQUANT_BASE_URL=https://api.llmquantdata.com\n",
  );
  writeFileSync(
    join(packageDir, ".env.local"),
    "LLMQUANT_BASE_URL=http://localhost:3000\n",
  );

  assert.deepEqual(collectEnvFileValues(packageDir), {
    LLMQUANT_API_KEY: "root_key",
    LLMQUANT_BASE_URL: "http://localhost:3000",
  });
});

test("loadEnvFiles does not overwrite explicit environment variables", () => {
  const root = mkdtempSync(join(tmpdir(), "llmquant-mcp-env-"));
  writeFileSync(
    join(root, ".env"),
    "LLMQUANT_API_KEY=file_key\nLLMQUANT_BASE_URL=http://localhost:3000\n",
  );

  const env = {
    LLMQUANT_API_KEY: "process_key",
  } as NodeJS.ProcessEnv;

  loadEnvFiles(env, root);

  assert.equal(env.LLMQUANT_API_KEY, "process_key");
  assert.equal(env.LLMQUANT_BASE_URL, "http://localhost:3000");
});

test("getEnv supports httpStream remote MCP settings without requiring a process API key", () => {
  const originalEnv = process.env;
  process.env = {
    LLMQUANT_MCP_TRANSPORT: "httpStream",
    LLMQUANT_INTERNAL_API_SECRET: "internal-secret",
    LLMQUANT_BASE_URL: "https://api.llmquantdata.test/",
    LLMQUANT_MCP_PORT: "9000",
    LLMQUANT_MCP_ALLOWED_ORIGINS:
      "https://llmquantdata.com, https://dashboard.llmquantdata.com",
    LLMQUANT_MCP_RATE_LIMIT_WINDOW_MS: "30000",
    LLMQUANT_MCP_RATE_LIMIT_MAX: "60",
  } as NodeJS.ProcessEnv;

  try {
    const env = getEnv([]);

    assert.equal(env.transport, "httpStream");
    assert.equal(env.baseUrl, "https://api.llmquantdata.test");
    assert.equal(env.apiKey, undefined);
    assert.equal(env.internalApiSecret, "internal-secret");
    assert.equal(env.mcpPort, 9000);
    assert.equal(env.mcpInternalPort, 9001);
    assert.deepEqual(env.allowedOrigins, [
      "https://llmquantdata.com",
      "https://dashboard.llmquantdata.com",
    ]);
    assert.equal(env.rateLimitWindowMs, 30_000);
    assert.equal(env.rateLimitMax, 60);
  } finally {
    process.env = originalEnv;
  }
});

test("getEnv falls back to platform PORT for httpStream deployments", () => {
  const originalEnv = process.env;
  process.env = {
    LLMQUANT_MCP_TRANSPORT: "httpStream",
    LLMQUANT_INTERNAL_API_SECRET: "internal-secret",
    PORT: "9100",
  } as NodeJS.ProcessEnv;

  try {
    const env = getEnv([]);

    assert.equal(env.mcpPort, 9100);
    assert.equal(env.mcpInternalPort, 9101);
  } finally {
    process.env = originalEnv;
  }
});
