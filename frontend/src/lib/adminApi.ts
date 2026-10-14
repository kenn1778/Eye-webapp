// Typed client for the admin API. Every call is best-effort: on any failure we
// return null and the dashboard keeps its last known (or empty) state, so a
// flaky network never blanks the workspace.

import { logError } from "./logger";
import type { AdminMetrics, AdminNotification, AdminInsights, ActivityPoint } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMetrics(value: unknown): value is AdminMetrics {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.posts) &&
    isFiniteNumber(value.stories) &&
    isFiniteNumber(value.subscribers) &&
    isFiniteNumber(value.chatMessages) &&
    isFiniteNumber(value.reviews) &&
    isFiniteNumber(value.unreadNotifications)
  );
}

function isNotification(value: unknown): value is AdminNotification {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    (value.body === null || typeof value.body === "string") &&
    (value.actor === null || typeof value.actor === "string") &&
    typeof value.read === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isInsights(value: unknown): value is AdminInsights {
  if (!isRecord(value)) return false;
  const window = (candidate: unknown) =>
    isRecord(candidate) &&
    isFiniteNumber(candidate.total) &&
    isFiniteNumber(candidate.last7Days) &&
    isFiniteNumber(candidate.last30Days);
  return (
    window(value.subscribers) &&
    window(value.chat) &&
    isRecord(value.reviews) &&
    isFiniteNumber(value.reviews.total) &&
    isFiniteNumber(value.reviews.averageRating) &&
    isRecord(value.posts) &&
    isFiniteNumber(value.posts.total) &&
    Array.isArray(value.topCommunities) &&
    value.topCommunities.every(
      (entry) => isRecord(entry) && typeof entry.name === "string" && isFiniteNumber(entry.messages),
    )
  );
}

function isActivityPoint(value: unknown): value is ActivityPoint {
  if (!isRecord(value)) return false;
  return (
    typeof value.date === "string" &&
    isFiniteNumber(value.subscribers) &&
    isFiniteNumber(value.chat) &&
    isFiniteNumber(value.reviews)
  );
}

async function getJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch (error) {
    logError("admin", `Request failed: ${path}`, error);
    return null;
  }
}

async function post(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
    });
    return response.ok;
  } catch (error) {
    logError("admin", `Request failed: ${path}`, error);
    return false;
  }
}

export async function fetchMetrics(): Promise<AdminMetrics | null> {
  const payload = await getJson("/api/v1/admin/metrics");
  return isMetrics(payload) ? payload : null;
}

export async function fetchInsights(): Promise<AdminInsights | null> {
  const payload = await getJson("/api/v1/admin/insights");
  return isInsights(payload) ? payload : null;
}

export async function fetchActivity(days = 14): Promise<ActivityPoint[] | null> {
  const payload = await getJson(`/api/v1/admin/activity?days=${days}`);
  if (!isRecord(payload) || !Array.isArray(payload.series)) return null;
  const series = payload.series.filter(isActivityPoint);
  return series.length > 0 ? series : null;
}

export async function fetchNotifications(
  limit = 20,
): Promise<{ notifications: AdminNotification[]; unread: number } | null> {
  const payload = await getJson(`/api/v1/admin/notifications?limit=${limit}`);
  if (!isRecord(payload) || !Array.isArray(payload.notifications)) return null;
  return {
    notifications: payload.notifications.filter(isNotification),
    unread: isFiniteNumber(payload.unread) ? payload.unread : 0,
  };
}

export function markNotificationRead(id: string): Promise<boolean> {
  return post(`/api/v1/admin/notifications/${encodeURIComponent(id)}/read`);
}

export function markAllNotificationsRead(): Promise<boolean> {
  return post("/api/v1/admin/notifications/read-all");
}

// Public chat persistence. Fire-and-forget: the demo chat must keep working even
// if the API is unreachable.
export async function postChatMessage(community: string, text: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/chat/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ community, text }),
    });
  } catch (error) {
    logError("chat", "Could not persist chat message", error);
  }
}

// Ask the EYE Assistant for a reply. Returns null when the assistant is
// unavailable so the chat can fall back to its built-in replies.
export async function fetchAgentReply(community: string, text: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/chat/agent`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ community, text }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    if (!isRecord(payload) || typeof payload.reply !== "string") return null;
    const reply = payload.reply.trim();
    return reply.length > 0 ? reply : null;
  } catch (error) {
    logError("chat", "Could not reach the assistant", error);
    return null;
  }
}
