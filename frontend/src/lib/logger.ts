// Central logger. Prints structured, PII-free messages to the console.
// Kept as a single seam so a backend log endpoint can be swapped in
// later without touching call sites.

type LogScope = "app" | "auth" | "admin" | "network";

function emit(level: "error" | "warn", scope: LogScope, message: string, detail?: unknown) {
  // The prefix keeps messages greppable and groups output by scope.
  const line = `[eye:${scope}] ${message}`;
  // Fall back to "" so a missing detail never prints as "undefined".
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
