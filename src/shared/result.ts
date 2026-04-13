export function formatToolResult<T>(payload: T) {
  return JSON.stringify(payload, null, 2);
}
