export function pairedStartEnd<T extends { start_time?: string; end_time?: string }>(
  value: T,
) {
  return (value.start_time === undefined) === (value.end_time === undefined);
}

export function orderedStartEnd<T extends { start_time?: string; end_time?: string }>(
  value: T,
) {
  return (
    !value.start_time ||
    !value.end_time ||
    Date.parse(value.start_time) <= Date.parse(value.end_time)
  );
}

export function eventCount(data: { events?: unknown[] }) {
  return Array.isArray(data.events) ? data.events.length : 0;
}
