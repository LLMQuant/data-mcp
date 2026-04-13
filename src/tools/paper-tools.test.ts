import assert from "node:assert/strict";
import test from "node:test";
import type { FastMCP } from "fastmcp";

import { registerReadPaperTool } from "./read-paper";
import { registerSearchPaperTool } from "./search-paper";

function createToolHarness() {
  const tools = new Map<string, { execute: (input: unknown) => Promise<string> }>();

  return {
    server: {
      addTool(tool: { name: string; execute: (input: unknown) => Promise<string> }) {
        tools.set(tool.name, tool);
      },
    } as unknown as FastMCP,
    get(name: string) {
      const tool = tools.get(name);

      if (!tool) {
        throw new Error(`Missing tool: ${name}`);
      }

      return tool;
    },
  };
}

test("paper_search formats items and preserves credit metadata", async () => {
  const harness = createToolHarness();
  const api = {
    async searchPaper() {
      return {
        data: [
          {
            paperCardId: "11111111-1111-1111-1111-111111111111",
            sourcePaperId: "manual_arxiv:2401.00001",
            title: "Paper Title",
            authors: ["Alice"],
            abstract: "Abstract",
            summary: "Summary",
            tags: ["ml"],
            availableSections: [
              {
                sectionKey: "introduction",
                sectionType: "introduction",
                title: "Introduction",
                charCount: 120,
                sectionOrder: 1,
              },
            ],
            sectionCount: 1,
            fullTextCharCount: 120,
            pdfUrl: "https://example.com/paper.pdf",
            semanticScore: 0.98765,
          },
        ],
        meta: {
          topK: 2,
          remainingCredits: 9,
          creditsUsed: 1,
        },
      };
    },
  };

  registerSearchPaperTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("paper_search").execute({
      query: "factor investing",
      topK: 2,
    }),
  ) as {
    summary: string;
    items: Array<{ semanticScore: number }>;
    meta: { creditsUsed: number };
  };

  assert.match(payload.summary, /Found 1 paper result/);
  assert.equal(payload.items[0]?.semanticScore, 0.9877);
  assert.equal(payload.meta.creditsUsed, 1);
});

test("paper_read treats ['all'] as a full-paper request", async () => {
  const harness = createToolHarness();
  let receivedSections: string[] | undefined;
  const api = {
    async readPaper({
      sections,
    }: {
      paperCardId: string;
      sections?: string[];
    }) {
      receivedSections = sections;

      return {
        data: {
          paperCardId: "11111111-1111-1111-1111-111111111111",
          sourcePaperId: "manual_arxiv:2401.00001",
          title: "Paper Title",
          authors: ["Alice"],
          abstract: "Abstract",
          summary: "Summary",
          tags: ["ml"],
          pdfUrl: "https://example.com/paper.pdf",
          sectionCount: 2,
          fullTextCharCount: 340,
          availableSections: [
            {
              sectionKey: "introduction",
              sectionType: "introduction",
              title: "Introduction",
              charCount: 120,
              sectionOrder: 1,
            },
            {
              sectionKey: "results",
              sectionType: "results",
              title: "Results",
              charCount: 220,
              sectionOrder: 2,
            },
          ],
          sourceUpdatedAt: "2026-03-24T00:00:00Z",
          createdAt: "2026-03-24T00:00:00Z",
          updatedAt: "2026-03-24T00:00:00Z",
          sections: [
            {
              paperCardId: "11111111-1111-1111-1111-111111111111",
              sectionKey: "introduction",
              sectionType: "introduction",
              title: "Introduction",
              sectionOrder: 1,
              bodyMarkdown: "# Intro",
              charCount: 120,
            },
            {
              paperCardId: "11111111-1111-1111-1111-111111111111",
              sectionKey: "results",
              sectionType: "results",
              title: "Results",
              sectionOrder: 2,
              bodyMarkdown: "## Results",
              charCount: 220,
            },
          ],
        },
      };
    },
  };

  registerReadPaperTool(harness.server, api as never);
  const payload = JSON.parse(
    await harness.get("paper_read").execute({
      paperCardId: "11111111-1111-1111-1111-111111111111",
      sections: ["all"],
    }),
  ) as {
    meta: {
      requestedSections: string[];
      fullTextRequested: boolean;
      returnedCharCount: number;
    };
  };

  assert.equal(receivedSections, undefined);
  assert.deepEqual(payload.meta.requestedSections, ["all"]);
  assert.equal(payload.meta.fullTextRequested, true);
  assert.equal(payload.meta.returnedCharCount, 340);
});
