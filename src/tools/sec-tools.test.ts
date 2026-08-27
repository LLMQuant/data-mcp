import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { McpToolRegistry } from "./registry";

import { registerLlmquantDataTools } from "../register-tools";
import { registerSecFilingBrowseTool } from "./sec-filing-browse";
import { registerSecFilingReadTool } from "./sec-filing-read";

interface HarnessTool {
  execute: (input: unknown) => Promise<string>;
  parameters: z.ZodTypeAny;
}

interface JsonSchemaBranch {
  type: string;
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, { enum?: string[]; pattern?: string }>;
}

function createToolHarness() {
  const tools = new Map<string, HarnessTool>();

  return {
    server: {
      addTool(tool: {
        name: string;
        parameters: z.ZodTypeAny;
        execute: (input: unknown) => Promise<string>;
      }) {
        tools.set(tool.name, { execute: tool.execute, parameters: tool.parameters });
      },
    } as McpToolRegistry,
    get(name: string) {
      const tool = tools.get(name);

      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }

      return tool;
    },
  };
}

// New unified envelope:
//   success → { data, meta: { creditsUsed, remainingCredits, notice? } }
// There is NO more `coverage` object / `availability` / `reason`. "No data"
// arrives as 200 + (possibly empty) data + an optional server-rendered
// `meta.notice`. MCP is a pure forwarder: it surfaces `notice` verbatim and
// never synthesizes its own coverage prose.

test("sec_filing_browse forwards filings and meta verbatim (no synthesized coverage)", async () => {
  const harness = createToolHarness();
  const calls: Array<Record<string, unknown>> = [];
  const api = {
    async getSecFilingBrowse(params: Record<string, unknown>) {
      calls.push(params);
      return {
        data: [
          {
            ticker: "AAPL",
            companyName: "Apple Inc.",
            filingType: "10-K",
            accessionNumber: "0000320193-26-000010",
            filingDate: "2026-02-01",
            reportDate: "2025-12-31",
            url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000010/aapl-20251231.htm",
            sectionKeys: ["1", "1A", "7"],
          },
          {
            ticker: "AAPL",
            companyName: "Apple Inc.",
            filingType: "10-Q",
            accessionNumber: "0000320193-26-000021",
            filingDate: "2026-05-02",
            reportDate: "2026-03-28",
            url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000021/aapl-20260328.htm",
            sectionKeys: [],
          },
        ],
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  const raw = await harness.get("sec_filing_browse").execute({
    ticker: "AAPL",
    limit: 2,
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    data: Array<{
      filingType: string;
      accessionNumber: string;
      sectionKeys: string[];
    }>;
    meta: { creditsUsed: number; remainingCredits: number; notice?: string };
  };

  // No notice present → guidance line built purely from the public data count.
  assert.match(payload.summary, /AAPL: 2 SEC filing/);
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0]?.filingType, "10-K");
  assert.equal(payload.data[1]?.accessionNumber, "0000320193-26-000021");
  // section_keys is surfaced verbatim (thin wrapper, never dropped).
  assert.deepEqual(payload.data[0]?.sectionKeys, ["1", "1A", "7"]);
  assert.deepEqual(payload.data[1]?.sectionKeys, []);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 99);
  assert.deepEqual(calls[0], {
    ticker: "AAPL",
    filingType: undefined,
    limit: 2,
  });
  // No coverage / availability fields are read or emitted anymore.
  assert.equal("coverage" in payload.meta, false);
  assert.doesNotMatch(raw, /coverage|availability|"reason"/);
});

test("sec_filing_browse forwards meta.notice verbatim on empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return {
        data: [],
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          notice: "We don't currently have 10-K filings for AAPL.",
        },
      };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_filing_browse").execute({
      ticker: "AAPL",
      filing_type: "10-K",
    }),
  ) as { summary: string; data: unknown[]; meta: { notice?: string } };

  // The Web-supplied notice is the human line — MCP forwards it unchanged.
  assert.equal(payload.summary, "We don't currently have 10-K filings for AAPL.");
  assert.equal(payload.meta.notice, "We don't currently have 10-K filings for AAPL.");
  assert.equal(payload.data.length, 0);
});

test("sec_filing_read formats first returned section and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      return {
        data: {
          ticker: "AAPL",
          filingType: "10-K",
          accessionNumber: "0000320193-26-000010",
          year: 2025,
          quarter: null,
          availableSections: [
            {
              sectionKey: "1A",
              sectionTitle: "Risk Factors",
              ordinal: 2,
              charCount: 1250,
            },
          ],
          items: [
            {
              number: "1A",
              name: "Risk Factors",
              text: "A".repeat(1250),
            },
          ],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
        },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const raw = await harness.get("sec_filing_read").execute({
    ticker: "AAPL",
    filing: { filing_type: "10-K", accession_number: "0000320193-26-000010" },
    items: ["1A"],
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    data: { accessionNumber: string | null; items: Array<{ number: string; text: string }> };
    meta: { creditsUsed: number; remainingCredits: number };
  };

  const expectedCharCount = (1250).toLocaleString("en-US");

  // No notice → guidance line built purely from public data (count + char len).
  assert.equal(
    payload.summary,
    `AAPL 10-K 1A (Risk Factors) — ${expectedCharCount} chars.`,
  );
  assert.equal(payload.data.accessionNumber, "0000320193-26-000010");
  assert.equal(payload.data.items[0]?.number, "1A");
  assert.equal(payload.data.items[0]?.text.length, 1250);
  assert.equal(payload.meta.creditsUsed, 1);
  assert.equal(payload.meta.remainingCredits, 99);
  // The coverage object is gone from both data and meta.
  assert.equal("coverage" in payload.data, false);
  assert.equal("coverage" in payload.meta, false);
  assert.doesNotMatch(raw, /coverage|availability|"reason"/);
});

test("sec_filing_read forwards meta.notice verbatim when no section text is available", async () => {
  const harness = createToolHarness();
  const NOTICE = "The requested section is not available for this AAPL 10-Q filing.";
  const api = {
    async getSecFilingRead() {
      return {
        data: {
          ticker: "AAPL",
          filingType: "10-Q",
          accessionNumber: "0000320193-26-000021",
          year: 2026,
          quarter: 2,
          availableSections: [],
          items: [],
        },
        meta: {
          creditsUsed: 1,
          remainingCredits: 99,
          notice: NOTICE,
        },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const raw = await harness.get("sec_filing_read").execute({
    ticker: "AAPL",
    filing: { filing_type: "10-Q", year: 2026, quarter: 2 },
  });
  const payload = JSON.parse(raw) as {
    summary: string;
    data: { items: unknown[] };
    meta: { notice?: string };
  };

  // Web's notice IS the human line — forwarded unchanged, no MCP prose.
  assert.equal(payload.summary, NOTICE);
  assert.equal(payload.meta.notice, NOTICE);
  assert.equal(payload.data.items.length, 0);
  assert.doesNotMatch(raw, /coverage|availability|"reason"/);
});

// ---------------------------------------------------------------------------
// `filing` locator union contract
//
// The three legal ways to point at a filing live in the schema itself, so a
// model can read them off the exported JSON Schema instead of discovering them
// through repeated validation errors. There are no `.refine()` rules left —
// every mutual-exclusion rule below is carried by the union structure.
// ---------------------------------------------------------------------------

const ACCESSION = "0000320193-26-000050";

/** The tool's own schema, as registered by the tool module. */
function readSchema(): z.ZodTypeAny {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  return harness.get("sec_filing_read").parameters;
}

/**
 * The schema as actually shipped: `registerLlmquantDataTools` wraps every tool
 * root in `.strict()`, which is what makes a locator field spilled back to the
 * root an error instead of a silently dropped key.
 */
function shippedReadSchema(): z.ZodTypeAny {
  const harness = createToolHarness();
  registerLlmquantDataTools(harness.server, {} as never);
  return harness.get("sec_filing_read").parameters;
}

/**
 * `ZodError.message` is a JSON dump of the issue list, so the readable text a
 * caller actually sees is the per-issue `message`. Assertions below run against
 * that text.
 */
function expectRejected(input: unknown, schema: z.ZodTypeAny = readSchema()) {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    throw new Error(`expected parse to fail for ${JSON.stringify(input)}`);
  }

  return {
    issues: parsed.error.issues,
    text: parsed.error.issues.map((issue) => issue.message).join(" | "),
  };
}

test("sec_filing_read accepts the annual period branch (10-K + year)", () => {
  const parsed = readSchema().safeParse({
    ticker: "AAPL",
    filing: { filing_type: "10-K", year: 2024 },
    items: ["1A"],
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_read accepts the quarterly period branch (10-Q + year + quarter)", () => {
  const parsed = readSchema().safeParse({
    ticker: "AAPL",
    filing: { filing_type: "10-Q", year: 2025, quarter: 2 },
    items: ["part1item2"],
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_read accepts the accession branch for 10-K / 10-Q / 8-K", () => {
  const schema = readSchema();

  for (const filingType of ["10-K", "10-Q", "8-K"] as const) {
    const parsed = schema.safeParse({
      ticker: "AAPL",
      filing: { filing_type: filingType, accession_number: ACCESSION },
      items: ["item2.02"],
    });

    assert.equal(parsed.success, true, `${filingType} + accession_number should parse`);
  }
});

test("sec_filing_read rejects period fields mixed with accession_number", () => {
  for (const filing of [
    { filing_type: "10-K", accession_number: ACCESSION, year: 2024 },
    { filing_type: "10-Q", accession_number: ACCESSION, quarter: 2 },
    { filing_type: "10-Q", accession_number: ACCESSION, year: 2025, quarter: 2 },
  ]) {
    const rejection = expectRejected({ ticker: "AAPL", filing });

    assert.equal(rejection.issues[0]?.path.join("."), "filing");
    assert.equal(rejection.issues[0]?.code, "invalid_union");
    assert.match(rejection.text, /do not combine year or quarter with accession_number/);
  }
});

test("sec_filing_read rejects a 10-K carrying quarter", () => {
  const rejection = expectRejected({
    ticker: "AAPL",
    filing: { filing_type: "10-K", year: 2024, quarter: 2 },
  });

  assert.match(rejection.text, /do not add quarter to a 10-K/);
});

test("sec_filing_read rejects an 8-K located by period", () => {
  for (const filing of [
    { filing_type: "8-K" },
    { filing_type: "8-K", year: 2026 },
    { filing_type: "8-K", year: 2026, quarter: 2 },
    { filing_type: "8-K", quarter: 2 },
  ]) {
    const rejection = expectRejected({ ticker: "AAPL", filing });

    assert.match(rejection.text, /8-K can only be read by accession_number/);
  }
});

test("sec_filing_read rejects a 10-Q located by year without quarter", () => {
  const rejection = expectRejected({
    ticker: "AAPL",
    filing: { filing_type: "10-Q", year: 2025 },
  });

  assert.match(rejection.text, /"quarter":2/);
});

test("sec_filing_read rejects sentinel placeholders in accession_number", () => {
  for (const sentinel of [":none", ":omit", ":ignore", "none", "0000320193-26-00005"]) {
    const rejection = expectRejected({
      ticker: "AAPL",
      filing: { filing_type: "8-K", accession_number: sentinel },
    });

    assert.equal(rejection.issues[0]?.path.join("."), "filing.accession_number");
    assert.match(rejection.text, /placeholder text is not accepted/);
  }
});

test("sec_filing_read rejects leading and trailing whitespace in accession_number", () => {
  for (const padded of [` ${ACCESSION}`, `${ACCESSION} `, ` ${ACCESSION} `]) {
    const rejection = expectRejected({
      ticker: "AAPL",
      filing: { filing_type: "8-K", accession_number: padded },
    });

    assert.equal(rejection.issues[0]?.path.join("."), "filing.accession_number");
    assert.match(rejection.text, /placeholder text is not accepted/);
  }
});

test("sec_filing_read rejects the flat pre-union locator", () => {
  // Every locator field at the root and no `filing` at all.
  const rejection = expectRejected({
    ticker: "AAPL",
    filing_type: "10-K",
    year: 2024,
  });

  assert.equal(
    rejection.issues.some((issue) => issue.path.join(".") === "filing"),
    true,
  );
  assert.match(rejection.text, /filing must match exactly one of three shapes/);
});

test("sec_filing_read rejects a locator field spilled to the root", () => {
  // Root is strict as shipped, so the stray field is an error rather than a
  // silently dropped key.
  const rejection = expectRejected(
    {
      ticker: "AAPL",
      filing: { filing_type: "10-K", year: 2024 },
      quarter: 2,
    },
    shippedReadSchema(),
  );

  assert.equal(rejection.issues[0]?.code, "unrecognized_keys");
  assert.equal(rejection.text, "Unrecognized parameter(s): remove unsupported parameters.");
});

test("sec_filing_read exports three closed locator branches in its JSON Schema", () => {
  const jsonSchema = z.toJSONSchema(readSchema(), {
    io: "input",
    unrepresentable: "any",
  }) as unknown as {
    required: string[];
    properties: { filing: { anyOf: JsonSchemaBranch[] } };
  };

  assert.deepEqual(jsonSchema.required, ["ticker", "filing"]);

  const branches = jsonSchema.properties.filing.anyOf;
  assert.equal(branches.length, 3);

  for (const branch of branches) {
    assert.equal(branch.type, "object");
    // Without this, a mixed locator would be stripped down to a valid branch
    // and silently succeed.
    assert.equal(branch.additionalProperties, false);
  }

  assert.deepEqual(
    branches.map((branch) => branch.required),
    [
      ["filing_type", "year"],
      ["filing_type", "year", "quarter"],
      ["filing_type", "accession_number"],
    ],
  );
  assert.deepEqual(
    branches.map((branch) => branch.properties.filing_type.enum),
    [["10-K"], ["10-Q"], ["10-K", "10-Q", "8-K"]],
  );
  assert.equal(
    branches[2].properties.accession_number?.pattern,
    "^\\d{10}-\\d{2}-\\d{6}$",
  );
});

test("sec_filing_read flattens each locator branch back into the existing query params", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead(params: Record<string, unknown>) {
      calls.push(params);
      return {
        data: {
          ticker: "AAPL",
          filingType: "10-K",
          accessionNumber: ACCESSION,
          year: 2024,
          quarter: null,
          availableSections: [],
          items: [],
        },
        meta: { creditsUsed: 1, remainingCredits: 99 },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const tool = harness.get("sec_filing_read");

  await tool.execute({ ticker: "AAPL", filing: { filing_type: "10-K", year: 2024 } });
  await tool.execute({
    ticker: "AAPL",
    filing: { filing_type: "10-Q", year: 2025, quarter: 2 },
  });
  await tool.execute({
    ticker: "AAPL",
    filing: { filing_type: "8-K", accession_number: ACCESSION },
    items: ["item2.02"],
  });

  assert.deepEqual(calls, [
    {
      ticker: "AAPL",
      filingType: "10-K",
      year: 2024,
      quarter: undefined,
      items: undefined,
      accessionNumber: undefined,
    },
    {
      ticker: "AAPL",
      filingType: "10-Q",
      year: 2025,
      quarter: 2,
      items: undefined,
      accessionNumber: undefined,
    },
    {
      ticker: "AAPL",
      filingType: "8-K",
      year: undefined,
      quarter: undefined,
      items: ["item2.02"],
      accessionNumber: ACCESSION,
    },
  ]);
});

test("sec_filing_read accepts an items batch and formats a multi-section summary", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      return {
        data: {
          ticker: "AAPL",
          filingType: "8-K",
          accessionNumber: "0000320193-26-000050",
          year: null,
          quarter: null,
          availableSections: [
            { sectionKey: "item2.02", sectionTitle: "Results of Operations", ordinal: 1, charCount: 100 },
            { sectionKey: "item9.01", sectionTitle: "Financial Statements and Exhibits", ordinal: 2, charCount: 50 },
          ],
          items: [
            { number: "item2.02", name: "Results of Operations", text: "A".repeat(100) },
            { number: "item9.01", name: "Financial Statements and Exhibits", text: "B".repeat(50) },
          ],
        },
        meta: { creditsUsed: 1, remainingCredits: 99 },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_filing_read").execute({
      ticker: "AAPL",
      filing: { filing_type: "8-K", accession_number: "0000320193-26-000050" },
      items: ["item2.02", "item9.01"],
    }),
  ) as { summary: string; data: { items: Array<{ number: string }> } };

  assert.match(payload.summary, /2 sections \(item2\.02, item9\.01\)/);
  assert.equal(payload.data.items.length, 2);
});

test("sec_filing_read rejects an items batch larger than 25", () => {
  const rejection = expectRejected({
    ticker: "AAPL",
    filing: { filing_type: "8-K", accession_number: "0000320193-26-000050" },
    items: Array.from({ length: 26 }, (_, i) => `item${i + 1}.01`),
  });

  assert.match(rejection.text, /25 or fewer/);
});

test("sec_filing_browse accepts filing_type 8-K", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return { data: [], meta: { creditsUsed: 1, remainingCredits: 99 } };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  const schema = harness.get("sec_filing_browse").parameters;
  const parsed = schema.safeParse({ ticker: "AAPL", filing_type: "8-K" });

  assert.equal(parsed.success, true);
});

test("sec_filing_browse output camelCase fields map cleanly to sec_filing_read inputs", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return {
        data: [
          {
            ticker: "NVDA",
            filingType: "8-K",
            accessionNumber: ACCESSION,
            reportDate: "2026-05-20",
            filingDate: "2026-05-20",
            sectionKeys: ["item2.02", "item9.01"],
          },
        ],
        meta: { creditsUsed: 0, remainingCredits: 100 },
      };
    },
    async getSecFilingRead(params: {
      ticker: string;
      filingType: string;
      accessionNumber?: string;
      items?: string[];
    }) {
      assert.equal(params.ticker, "NVDA");
      assert.equal(params.filingType, "8-K");
      assert.equal(params.accessionNumber, ACCESSION);
      assert.deepEqual(params.items, ["item2.02", "item9.01"]);
      return {
        data: {
          ticker: "NVDA",
          filingType: "8-K",
          accessionNumber: ACCESSION,
          year: null,
          quarter: null,
          availableSections: [
            { sectionKey: "item2.02", sectionTitle: "Results of Operations", ordinal: 1, charCount: 100 },
            { sectionKey: "item9.01", sectionTitle: "Financial Statements and Exhibits", ordinal: 2, charCount: 50 },
          ],
          items: [
            { number: "item2.02", name: "Results of Operations", text: "Q1 Results" },
            { number: "item9.01", name: "Financial Statements and Exhibits", text: "Exhibits" },
          ],
        },
        meta: { creditsUsed: 1, remainingCredits: 99 },
      };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  registerSecFilingReadTool(harness.server, api as never);

  const browseResult = JSON.parse(
    await harness.get("sec_filing_browse").execute({ ticker: "NVDA", filing_type: "8-K" }),
  ) as { data: Array<{ filingType: "8-K"; accessionNumber: string; sectionKeys: string[] }> };

  const firstFiling = browseResult.data[0];
  assert.ok(firstFiling);

  // Map browse camelCase outputs to read snake_case inputs:
  const readResult = JSON.parse(
    await harness.get("sec_filing_read").execute({
      ticker: "NVDA",
      filing: {
        filing_type: firstFiling.filingType,
        accession_number: firstFiling.accessionNumber,
      },
      items: firstFiling.sectionKeys,
    }),
  ) as { data: { items: Array<{ number: string; text: string }> } };

  assert.equal(readResult.data.items.length, 2);
  assert.equal(readResult.data.items[0]?.number, "item2.02");
});
