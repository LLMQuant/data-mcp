import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import type { McpToolRegistry } from "./registry";

import { registerSecFilingBrowseTool } from "./sec-filing-browse";
import { registerSecFilingReadTool } from "./sec-filing-read";

interface HarnessTool {
  execute: (input: unknown) => Promise<string>;
  parameters: z.ZodTypeAny;
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

// New unified envelope (contexts/project/api/response-contract.md §三):
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
    filing_type: "10-K",
    accession_number: "0000320193-26-000010",
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
    filing_type: "10-Q",
    year: 2026,
    quarter: 2,
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

test("sec_filing_read rejects accession_number combined with year (Closes #283)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "10-K",
    accession_number: "0000320193-24-000123",
    year: 2024,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail when accession_number combined with year");
  }
  assert.match(parsed.error.message, /cannot be combined with year or quarter/);
});

test("sec_filing_read rejects accession_number combined with quarter (Closes #283)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "10-Q",
    accession_number: "0000320193-24-000123",
    quarter: 2,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail when accession_number combined with quarter");
  }
  assert.match(parsed.error.message, /cannot be combined with year or quarter/);
});

test("sec_filing_read accepts accession_number alone", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "10-K",
    accession_number: "0000320193-24-000123",
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_read accepts year + quarter without accession_number", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "10-Q",
    year: 2024,
    quarter: 2,
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_read rejects 8-K without accession_number (Closes #305)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "8-K",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail for 8-K without accession_number");
  }
  assert.match(parsed.error.message, /8-K filings require accession_number/);
});

test("sec_filing_read rejects 8-K located by year without accession_number (Closes #305)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "8-K",
    year: 2026,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail for 8-K located by year");
  }
  assert.match(parsed.error.message, /8-K filings require accession_number/);
});

test("sec_filing_read rejects quarter for 8-K (Closes #305)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "8-K",
    quarter: 2,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail when quarter passed for 8-K");
  }
  assert.match(parsed.error.message, /quarter is only valid for 10-Q/);
});

test("sec_filing_read accepts 8-K with accession_number + items (Closes #305)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "8-K",
    accession_number: "0000320193-26-000050",
    items: ["item2.02"],
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_read accepts an items batch and formats a multi-section summary (Issue #326)", async () => {
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
      filing_type: "8-K",
      accession_number: "0000320193-26-000050",
      items: ["item2.02", "item9.01"],
    }),
  ) as { summary: string; data: { items: Array<{ number: string }> } };

  assert.match(payload.summary, /2 sections \(item2\.02, item9\.01\)/);
  assert.equal(payload.data.items.length, 2);
});

test("sec_filing_read rejects an items batch larger than 25 (Issue #326)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingRead() {
      throw new Error("should not be called");
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const schema = harness.get("sec_filing_read").parameters;
  const parsed = schema.safeParse({
    ticker: "AAPL",
    filing_type: "8-K",
    accession_number: "0000320193-26-000050",
    items: Array.from({ length: 26 }, (_, i) => `item${i + 1}.01`),
  });

  assert.equal(parsed.success, false);
  if (parsed.success) {
    throw new Error("expected parse to fail for an items batch larger than 25");
  }
  assert.match(parsed.error.message, /25 or fewer/);
});

test("sec_filing_browse accepts filing_type 8-K (Closes #305)", () => {
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
