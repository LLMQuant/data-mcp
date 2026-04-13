import { ZodError } from "zod";

import { getEnv } from "./env";
import { createServer } from "./server";

async function main() {
  const env = getEnv();
  const server = createServer(env);

  await server.start({
    transportType: "stdio",
  });
}

main().catch((error) => {
  if (error instanceof ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");

    console.error(`Invalid environment configuration:\n${details}`);
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Failed to start LLMQuant Data MCP server.");
  }

  process.exitCode = 1;
});
