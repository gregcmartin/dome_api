export function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}

export function parseInteger(value: string) {
  if (!/^-?\d+$/.test(value)) throw new Error(`Expected an integer, got "${value}"`);
  return Number.parseInt(value, 10);
}

export function parseNumber(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Expected a number, got "${value}"`);
  return n;
}

export function parseOptionalInteger(value: string) {
  return value === undefined ? undefined : parseInteger(value);
}

function parseTime(value: string): Date {
  // Accept unix timestamps as strings for convenience; use Date parsing for ISO.
  // Callers decide whether seconds or ms are desired.
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error(`Invalid time: "${value}" (expected unix timestamp or ISO-8601)`);
  }
  return asDate;
}

export function parseUnixSeconds(value: string): number {
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return Math.floor(parseTime(value).getTime() / 1000);
}

export function parseUnixMilliseconds(value: string): number {
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return parseTime(value).getTime();
}

export function requireApiKey(apiKey: string | undefined): asserts apiKey is string {
  if (!apiKey) throw new Error("Missing API key. Provide --api-key or set DOME_API_KEY.");
}
