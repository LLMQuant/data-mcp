// Fail-closed generic used only when Web did NOT hand us a usable
// `{ error: { code, message } }` body (malformed / non-JSON / missing). When
// Web sends its sanitized error envelope we surface that message verbatim —
// Web is the single owner of public error phrasing.
const GENERIC_API_ERROR_MESSAGE =
  "The LLMQuant API request could not be completed. Please try again later.";

/** Stable public error codes (response-contract.md §五). */
export type LlmquantApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "insufficient_credits"
  | "rate_limited"
  | "service_unavailable"
  | "internal_error";

export class LlmquantApiError extends Error {
  readonly status: number;
  readonly url: string;
  /** Public, stable error code forwarded from Web's `{ error: { code } }`. */
  readonly code?: string;
  readonly detail?: unknown;

  constructor({
    message,
    status,
    url,
    code,
    detail,
  }: {
    message: string;
    status: number;
    url: string;
    code?: string;
    detail?: unknown;
  }) {
    super(message);
    this.name = "LlmquantApiError";
    this.status = status;
    this.url = url;
    this.code = code;
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

/**
 * Translate a non-OK Web response into an `LlmquantApiError`.
 *
 * Web now owns all public error phrasing and ships a sanitized envelope:
 * `{ error: { code, message } }` (response-contract.md §五). We forward that
 * `message` (and `code`) verbatim — MCP no longer rephrases 5xx or any other
 * status into its own copy. We only fall back to a generic message when Web
 * did NOT give us a usable error object (non-JSON / malformed / missing) so the
 * tool still fails closed without leaking a raw body or status string.
 */
export async function toLlmquantApiError(response: Response) {
  let detail: unknown;
  let message = GENERIC_API_ERROR_MESSAGE;
  let code: string | undefined;

  try {
    const raw = await response.text();

    if (raw) {
      try {
        detail = JSON.parse(raw) as unknown;

        if (
          detail &&
          typeof detail === "object" &&
          "error" in detail &&
          detail.error &&
          typeof detail.error === "object"
        ) {
          const errorObject = detail.error as { code?: unknown; message?: unknown };

          if (typeof errorObject.message === "string" && errorObject.message) {
            message = errorObject.message;
          }
          if (typeof errorObject.code === "string" && errorObject.code) {
            code = errorObject.code;
          }
        }
      } catch {
        detail = raw;
      }
    }
  } catch {
    detail = undefined;
  }

  return new LlmquantApiError({
    message,
    status: response.status,
    url: response.url,
    code,
    detail,
  });
}

export function describeToolError(error: unknown) {
  if (error instanceof LlmquantApiError) {
    // Web owns the public error phrasing; forward its sanitized `message`
    // verbatim. Never append raw status/url or response bodies here.
    return error.message;
  }

  if (error instanceof LlmquantTransportError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown tool execution error.";
}
