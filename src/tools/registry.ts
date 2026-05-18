import type { z } from "zod";

export interface McpToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  parameters: Schema;
  execute: (args: z.infer<Schema>, context?: unknown) => unknown | Promise<unknown>;
}

export interface McpToolRegistry {
  addTool<Schema extends z.ZodTypeAny>(tool: McpToolDefinition<Schema>): void;
}
