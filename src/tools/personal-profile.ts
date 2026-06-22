import type { McpToolRegistry } from "./registry";
import { z } from "zod";

import { getApiClient, type ApiClientProvider } from "../client/api-provider";
import { describeToolError } from "../shared/errors";
import { formatToolResult } from "../shared/result";

export function registerPersonalProfileTool(
  server: McpToolRegistry,
  api: ApiClientProvider,
) {
  server.addTool({
    name: "personal_profile",
    description:
      "Read the financial profile you saved in your LLMQuant Dashboard → " +
      "Profile: risk preference, investment horizon, base currency, and " +
      "free-form notes. Use this when the question touches the user's own " +
      "risk tolerance, time horizon, base currency, or personal constraints. " +
      "Returns only your own saved profile; it cannot see anyone else's data " +
      "and is read-only.\n\n" +
      "Inputs: none.\n\n" +
      "Returns: data with risk_preference, investment_horizon, base_currency, " +
      "and extra_notes. If the user has not saved a profile, data is null.\n\n" +
      "Credit rule: 0 credits.",
    parameters: z.object({}),
    execute: async (_args, context) => {
      try {
        const response = await getApiClient(api, context).getPersonalProfile();
        const summary = response.data
          ? "Loaded your saved LLMQuant financial profile."
          : "No saved financial profile found in your LLMQuant profile.";
        return formatToolResult({
          summary,
          data: response.data,
          meta: response.meta,
        });
      } catch (error) {
        throw new Error(describeToolError(error));
      }
    },
  });
}
