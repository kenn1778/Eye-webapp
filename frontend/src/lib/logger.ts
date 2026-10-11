// Central logger. Prints structured, PII-free messages to the console.
// Kept as a single seam so a backend log endpoint can be swapped in
// later without touching call sites.

type LogScope = "app" | "auth" | "admin" | "network";

function emit(level: "error" | "warn", scope: LogScope, message: string, detail?: unknown) {
  const line = `[eye:${scope}] ${message}`;
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
