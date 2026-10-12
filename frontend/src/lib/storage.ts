// Safe wrappers around the Web Storage API.
//
// Storage is not guaranteed to work: Safari private mode throws on access,
// users can disable site data, and writes can exceed the quota. Reading raw
// localStorage at a call site is also easy to get wrong - a corrupted value
// makes JSON.parse throw and takes the whole component down with it.
//
// Every storage read/write in the app goes through this module so a storage
// failure degrades quietly instead of crashing the UI.

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

/**
 * Read and parse a JSON value.
 *
 * Returns `fallback` when the key is missing, the stored text is not valid
 * JSON, or storage is unavailable. When `isValid` is supplied, a parsed value
 * that fails the check is also treated as missing - this stops hand-edited or
 * stale data from reaching components that assume a known shape.
 */
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

/** Generate a unique id, preferring the platform UUID implementation. */
export function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  // Older browsers lack randomUUID; timestamp + random is unique enough for
  // client-side keys and stays collision-safe within a session.
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}