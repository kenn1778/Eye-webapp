// Auth talks to the EYE API. The server sets a signed, HttpOnly session cookie,
// so the browser never holds the password.

import { logError } from "./logger";

export type SessionUser = { email: string };
export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string };

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

// A malformed or empty body should not throw past this point - callers branch
// on the HTTP status, so swallow parse errors and hand back an empty object.
async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      // Required so the browser accepts and stores the HttpOnly session cookie.
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await parseJson(response);
    if (!response.ok) {
      // The API nests errors as { error: { message } }; older routes use a
      // top-level message. A 5xx is never a credential problem, so do not tell
      // the user their password is wrong when the server is misconfigured.
      const nested = (data.error as { message?: unknown } | undefined)?.message;
      const serverMessage =
        (typeof data.message === "string" && data.message) ||
        (typeof nested === "string" ? nested : "");
      if (response.status >= 500) {
        logError("auth", `Login failed with ${response.status}: ${serverMessage || "no message"}`);
        return { ok: false, error: "Unable to sign in right now. Please try again." };
      }
      return { ok: false, error: serverMessage || "Invalid email or password." };
    }
    // Server may omit the user; reuse the submitted email so the UI still has
    // an identity to show.
    const user = (data.user as SessionUser | undefined) ?? { email };
    return { ok: true, user };
  } catch (error) {
    logError("auth", "Login request failed", error);
    return { ok: false, error: "Unable to reach the sign-in service. Please try again." };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    logError("auth", "Logout request failed", error);
  }
}

// null means "not confirmed" rather than a hard error - callers treat it as
// signed out, so a transient network failure degrades to the login screen.
export async function getSession(): Promise<SessionUser | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/me`, { credentials: "include" });
    if (!response.ok) return null;
    const data = await parseJson(response);
    return (data.user as SessionUser | undefined) ?? null;
  } catch {
    // Offline or blocked request - same outcome as "no session".
    return null;
  }
}

// Response ignored on purpose: the server shouldn't reveal whether an account
// exists, and the UI shows the same confirmation either way.
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    logError("auth", "Password reset request failed", error);
  }
}
