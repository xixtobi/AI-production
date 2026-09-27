import "server-only";

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface SystemLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const dataDirectory = process.env.PRODUCTION_CONTROL_DATA_DIR
  ? path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR)
  : path.join(process.cwd(), ".local-production-control");

const logsDir = path.join(dataDirectory, "logs");

function ensureLogsDir() {
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Strips sensitive keys (API keys, passwords, tokens) from any logged object.
 */
function sanitizeContext(ctx?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    const lk = k.toLowerCase();
    if (lk.includes("key") || lk.includes("secret") || lk.includes("token") || lk.includes("password")) {
      sanitized[k] = "[REDACTED]";
    } else if (typeof v === "string" && v.startsWith("AIzaSy")) {
      // Gemini API key signature pattern
      sanitized[k] = "[REDACTED_API_KEY]";
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function logSystemEvent(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  ensureLogsDir();
  const entry: SystemLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: message.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, "[REDACTED_KEY]"),
    context: sanitizeContext(context),
  };

  const line = JSON.stringify(entry) + "\n";
  const logFile = path.join(logsDir, "production-control.log");
  appendFileSync(logFile, line, "utf8");

  if (level === "ERROR") {
    const errFile = path.join(logsDir, "error.log");
    appendFileSync(errFile, line, "utf8");
  }
}

export function readSystemLogs(limit = 100, type: "combined" | "error" = "combined"): SystemLogEntry[] {
  ensureLogsDir();
  const filename = type === "error" ? "error.log" : "production-control.log";
  const logFile = path.join(logsDir, filename);
  if (!existsSync(logFile)) return [];

  try {
    const content = readFileSync(logFile, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const recent = lines.slice(-limit).reverse();
    const parsed: SystemLogEntry[] = [];

    for (const l of recent) {
      try {
        parsed.push(JSON.parse(l));
      } catch {
        // Skip unparseable line
      }
    }

    return parsed;
  } catch {
    return [];
  }
}

export function getRecentSystemLogs(limit = 100): SystemLogEntry[] {
  return readSystemLogs(limit, "combined");
}

export function getSystemLogPath(): string {
  ensureLogsDir();
  return path.join(logsDir, "production-control.log");
}
