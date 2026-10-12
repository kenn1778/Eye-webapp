// Client-side auth against the EYE API.
//
// Credentials are verified by the server (see ../../backend). The server issues
// a signed, HttpOnly session cookie, so the browser never holds the password.

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
      const message = typeof data.message === "string" ? data.message : "Invalid email or password.";
      return { ok: false, error: message };
    }
    // A success response may omit the user; fall back to the submitted email so
    // the UI still has an identity to display.
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

// The response is deliberately ignored: the server must not reveal whether an
// account exists, and the UI shows the same confirmation either way.
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
