import chalk from "chalk";

let jsonMode = false;
let noColor = false;

export function setOutputMode(opts: { json?: boolean; noColor?: boolean }): void {
  jsonMode = opts.json ?? false;
  noColor = opts.noColor ?? false;
  if (noColor) chalk.level = 0;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(rows: Record<string, string>[]): void {
  if (rows.length === 0) return;

  const keys = Object.keys(rows[0]!);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => (r[k] ?? "").length)),
  );

  const header = keys.map((k, i) => k.padEnd(widths[i]!)).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──");

  console.log(chalk.bold(header));
  console.log(sep);
  for (const row of rows) {
    const line = keys.map((k, i) => (row[k] ?? "").padEnd(widths[i]!)).join("  ");
    console.log(line);
  }
}
