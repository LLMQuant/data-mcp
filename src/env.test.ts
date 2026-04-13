import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectEnvFileValues, loadEnvFiles, parseDotenv } from "./env";

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
