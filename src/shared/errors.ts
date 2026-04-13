export class LlmquantApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly detail?: unknown;

  constructor({
    message,
    status,
    url,
    detail,
  }: {
    message: string;
    status: number;
    url: string;
    detail?: unknown;
  }) {
    super(message);
    this.name = "LlmquantApiError";
    this.status = status;
    this.url = url;
    this.detail = detail;
  }
}

export class LlmquantTransportError extends Error {
  readonly url: string;

  constructor(message: string, url: string) {
    super(message);
    this.name = "LlmquantTransportError";
    this.url = url;
  }
}

export async function toLlmquantApiError(response: Response) {
  let detail: unknown;
  let message = `LLMQuant API request failed with status ${response.status}.`;

  try {
    const raw = await response.text();

    if (raw) {
      try {
        detail = JSON.parse(raw) as unknown;

        if (
          detail &&
          typeof detail === "object" &&
          "error" in detail &&
          typeof detail.error === "string"
        ) {
          message = detail.error;
        }
      } catch {
        detail = raw;
        message = raw;
      }
    }
  } catch {
    detail = undefined;
  }

  return new LlmquantApiError({
    message,
    status: response.status,
    url: response.url,
    detail,
  });
}

export function describeToolError(error: unknown) {
  if (error instanceof LlmquantApiError) {
    return `${error.message} (status ${error.status}, url: ${error.url})`;
  }

  if (error instanceof LlmquantTransportError) {
    return `${error.message} (url: ${error.url})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown tool execution error.";
}
