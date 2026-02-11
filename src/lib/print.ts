export function printJson(value: unknown, opts: { pretty: boolean }) {
  const out = opts.pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(out + "\n");
}

