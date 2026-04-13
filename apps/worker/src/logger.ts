/**
 * Structured JSON logger for the worker process.
 * Outputs one JSON object per line — compatible with log aggregators
 * (Datadog, Grafana Loki, CloudWatch, etc.)
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  msg: string;
  service: string;
  timestamp: string;
  [key: string]: unknown;
}

function write(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    msg,
    service: "foxhound-worker",
    timestamp: new Date().toISOString(),
    ...context,
  };
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info: (msg: string, context?: Record<string, unknown>) => write("info", msg, context),
  warn: (msg: string, context?: Record<string, unknown>) => write("warn", msg, context),
  error: (msg: string, context?: Record<string, unknown>) => write("error", msg, context),
  debug: (msg: string, context?: Record<string, unknown>) => write("debug", msg, context),

  /** Create a child logger with preset context fields */
  child: (defaults: Record<string, unknown>) => ({
    info: (msg: string, ctx?: Record<string, unknown>) =>
      write("info", msg, { ...defaults, ...ctx }),
    warn: (msg: string, ctx?: Record<string, unknown>) =>
      write("warn", msg, { ...defaults, ...ctx }),
    error: (msg: string, ctx?: Record<string, unknown>) =>
      write("error", msg, { ...defaults, ...ctx }),
    debug: (msg: string, ctx?: Record<string, unknown>) =>
      write("debug", msg, { ...defaults, ...ctx }),
  }),
};
