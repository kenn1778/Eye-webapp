// localStorage throws in Safari private mode, when site data is blocked, or on
// quota overflow, and one bad JSON value is enough to take a component down.
// Everything goes through here so storage failures stay quiet.

const canUseStorage = (): boolean => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Accessing localStorage itself can throw when site data is blocked.
    return false;
  }
};

export function readString(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): boolean {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // Quota exceeded, or storage disabled mid-session.
  }
}

export function removeItem(key: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing useful to do if removal fails.
  }
}

// Returns the fallback when the key is missing, the stored text isn't valid
// JSON, or isValid rejects the parsed value - keeps hand-edited or stale data
// out of components that assume a known shape.
export function readJson<T>(fallback: T, key: string, isValid?: (value: unknown) => value is T): T {
  const raw = readString(key);
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback; // Corrupted entry - drop it rather than crash.
  }

  if (isValid && !isValid(parsed)) return fallback;
  return parsed as T;
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value));
  } catch {
    return false; // Circular structure or a value that cannot be serialised.
  }
}

export function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  // Older browsers lack randomUUID; timestamp + random is unique enough for
  // client-side keys and stays collision-safe within a session.
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}