// Single logger seam: PII-free console output now, and a backend log endpoint
// can drop in later without touching call sites.

type LogScope = "app" | "auth" | "admin" | "chat" | "network";

function emit(level: "error" | "warn", scope: LogScope, message: string, detail?: unknown) {
  // The prefix keeps messages greppable and groups output by scope.
  const line = `[eye:${scope}] ${message}`;
  // Empty string so a missing detail doesn't print as "undefined".
  if (level === "error") {
    console.error(line, detail ?? "");
  } else {
    console.warn(line, detail ?? "");
  }
}

export function logError(scope: LogScope, message: string, detail?: unknown) {
  emit("error", scope, message, detail);
}

export function logWarn(scope: LogScope, message: string, detail?: unknown) {
  emit("warn", scope, message, detail);
}
