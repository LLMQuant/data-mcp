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

test("sec_filing_browse formats filings and preserves metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return {
        data: [
          {
            secFilingId: "11111111-1111-1111-1111-111111111111",
            ticker: "AAPL",
            companyName: "Apple Inc.",
            filingType: "10-K",
            accessionNumber: "0000320193-26-000010",
            filingDate: "2026-02-01",
            reportDate: "2025-12-31",
            url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000010/aapl-20251231.htm",
          },
          {
            secFilingId: "22222222-2222-2222-2222-222222222222",
            ticker: "AAPL",
            companyName: "Apple Inc.",
            filingType: "10-Q",
            accessionNumber: "0000320193-26-000021",
            filingDate: "2026-05-02",
            reportDate: "2026-03-28",
            url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000021/aapl-20260328.htm",
          },
        ],
        meta: {
          count: 2,
          creditsUsed: 1,
        },
      };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_filing_browse").execute({
      ticker: "AAPL",
      limit: 2,
    }),
  ) as {
    summary: string;
    items: Array<{ filingType: string; accessionNumber: string }>;
    meta: { count: number; creditsUsed: number };
  };

  assert.match(payload.summary, /AAPL: 2 filing/);
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0]?.filingType, "10-K");
  assert.equal(payload.items[1]?.accessionNumber, "0000320193-26-000021");
  assert.equal(payload.meta.count, 2);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("sec_filing_browse handles empty result", async () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return {
        data: [],
        meta: {
          count: 0,
          creditsUsed: 1,
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
  ) as { summary: string; items: unknown[] };

  assert.match(payload.summary, /No SEC filings found for AAPL/);
  assert.equal(payload.items.length, 0);
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
          count: 1,
          creditsUsed: 1,
        },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_filing_read").execute({
      ticker: "AAPL",
      filing_type: "10-K",
      accession_number: "0000320193-26-000010",
      item: "1A",
    }),
  ) as {
    summary: string;
    item: { accessionNumber: string | null; items: Array<{ number: string; text: string }> };
    meta: { count: number; creditsUsed: number };
  };

  const expectedCharCount = (1250).toLocaleString("en-US");

  assert.equal(
    payload.summary,
    `AAPL 10-K 1A (Risk Factors) — ${expectedCharCount} chars.`,
  );
  assert.equal(payload.item.accessionNumber, "0000320193-26-000010");
  assert.equal(payload.item.items[0]?.number, "1A");
  assert.equal(payload.item.items[0]?.text.length, 1250);
  assert.equal(payload.meta.count, 1);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("sec_filing_read handles empty result", async () => {
  const harness = createToolHarness();
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
          count: 0,
          creditsUsed: 1,
        },
      };
    },
  };

  registerSecFilingReadTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("sec_filing_read").execute({
      ticker: "AAPL",
      filing_type: "10-Q",
      year: 2026,
      quarter: 2,
    }),
  ) as { summary: string; item: { items: unknown[] } };

  assert.match(payload.summary, /AAPL 10-Q: no section text returned/);
  assert.equal(payload.item.items.length, 0);
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

test("sec_filing_read accepts 8-K with accession_number + item (Closes #305)", () => {
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
    item: "item2.02",
  });

  assert.equal(parsed.success, true);
});

test("sec_filing_browse accepts filing_type 8-K (Closes #305)", () => {
  const harness = createToolHarness();
  const api = {
    async getSecFilingBrowse() {
      return { data: [], meta: { count: 0, creditsUsed: 0 } };
    },
  };

  registerSecFilingBrowseTool(harness.server, api as never);
  const schema = harness.get("sec_filing_browse").parameters;
  const parsed = schema.safeParse({ ticker: "AAPL", filing_type: "8-K" });

  assert.equal(parsed.success, true);
});
