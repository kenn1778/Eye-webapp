// Typed client for the admin API. Every call is best-effort: on any failure we
// return null and the dashboard keeps its last known (or empty) state, so a
// flaky network never blanks the workspace.

import { logError } from "./logger";
import type { AdminMetrics, AdminNotification, AdminInsights, ActivityPoint, AdminContactMessage, AdminAuthorProfile } from "../types";

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

// Older backends predate the views/messages counters; fill them with zeros so
// the dashboard renders instead of showing undefined.
function withMetricDefaults(value: AdminMetrics): AdminMetrics {
  return {
    ...value,
    views: typeof value.views === "number" ? value.views : 0,
    messages: typeof value.messages === "number" ? value.messages : 0,
    unreadMessages: typeof value.unreadMessages === "number" ? value.unreadMessages : 0,
  };
}

function withInsightDefaults(value: AdminInsights): AdminInsights {
  return {
    ...value,
    views: isRecord(value.views) && isFiniteNumber(value.views.total) ? value.views : { total: 0 },
    messages:
      isRecord(value.messages) && isFiniteNumber(value.messages.total)
        ? value.messages
        : { total: 0, last7Days: 0, last30Days: 0 },
  };
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
  return isMetrics(payload) ? withMetricDefaults(payload) : null;
}

export async function fetchInsights(): Promise<AdminInsights | null> {
  const payload = await getJson("/api/v1/admin/insights");
  return isInsights(payload) ? withInsightDefaults(payload) : null;
}

export async function fetchActivity(days = 14): Promise<ActivityPoint[] | null> {
  const payload = await getJson(`/api/v1/admin/activity?days=${days}`);
  if (!isRecord(payload) || !Array.isArray(payload.series)) return null;
  const series = payload.series.filter(isActivityPoint);
  return series.length > 0
    ? series.map((point) => ({ ...point, views: typeof point.views === "number" ? point.views : 0 }))
    : null;
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
// Posts CRUD
export async function fetchPosts(search = "", limit = 20, offset = 0, status?: string) {
  const params = new URLSearchParams({ search, limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  const payload = await getJson(`/api/v1/admin/posts?${params}`);
  if (!isRecord(payload) || !Array.isArray(payload.items) || !isFiniteNumber(payload.total)) return null;
  return { items: payload.items.filter(isPostRecord), total: payload.total };
}

export type PostRecord = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  image: string;
  actionUrl: string | null;
  actionLabel: string | null;
  mediaAssetId: string | null;
  linkHeaderAssetId: string | null;
  audioAssetId: string | null;
  videoAssetId: string | null;
  linkHeaderUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  status: "draft" | "published" | "scheduled";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
};

function isPostRecord(value: unknown): value is PostRecord {
  return (
    isRecord(value) && typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.content === "string" && typeof value.excerpt === "string" &&
    typeof value.category === "string" && typeof value.image === "string" &&
    (value.actionUrl === null || typeof value.actionUrl === "string") &&
    (value.actionLabel === null || typeof value.actionLabel === "string") &&
    (value.mediaAssetId === null || typeof value.mediaAssetId === "string") &&
    (value.linkHeaderAssetId === null || typeof value.linkHeaderAssetId === "string") &&
    (value.audioAssetId === null || typeof value.audioAssetId === "string") &&
    (value.videoAssetId === null || typeof value.videoAssetId === "string") &&
    ["draft", "published", "scheduled"].includes(String(value.status)) &&
    (value.deletedAt === null || typeof value.deletedAt === "string") &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string"
  );
}

export type PostInput = Omit<PostRecord, "id" | "deletedAt" | "createdAt" | "updatedAt" | "mediaAssetId" | "linkHeaderAssetId" | "audioAssetId" | "videoAssetId"> &
  Partial<Pick<PostRecord, "mediaAssetId" | "linkHeaderAssetId" | "audioAssetId" | "videoAssetId">>;

async function sendJson(path: string, method: "POST" | "PATCH", body: unknown): Promise<unknown | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logError("admin", `Request failed: ${path}`, error);
    return null;
  }
}

export async function createPost(post: PostInput): Promise<PostRecord | null> {
  try {
    const result = await sendJson("/api/v1/admin/posts", "POST", post);
    return isPostRecord(result) ? result : null;
  } catch (error) {
    logError("admin", "createPost failed", error);
    return null;
  }
}

export async function updatePost(id: string, data: Partial<PostInput>): Promise<PostRecord | null> {
  try {
    const result = await sendJson(`/api/v1/admin/posts/${encodeURIComponent(id)}`, "PATCH", data);
    return isPostRecord(result) ? result : null;
  } catch (error) {
    logError("admin", "updatePost failed", error);
    return null;
  }
}

export async function deletePost(id: string) {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/posts/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    return response.ok;
  } catch (error) {
    logError("admin", "deletePost failed", error);
    return false;
  }
}

export async function restorePost(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/posts/${encodeURIComponent(id)}/restore`, { method: "POST", credentials: "include" });
    return response.ok;
  } catch (error) {
    logError("admin", "restorePost failed", error);
    return false;
  }
}

export async function fetchPublicPosts(): Promise<PostRecord[] | null> {
  const payload = await getJson("/api/v1/public/posts");
  if (!isRecord(payload) || !Array.isArray(payload.items)) return null;
  const publicPosts = payload.items.filter((value): value is Record<string, unknown> & { publishedAt: string; createdAt: string } =>
    isRecord(value) && typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.content === "string" && typeof value.excerpt === "string" &&
    typeof value.category === "string" && typeof value.image === "string" &&
    (value.actionUrl === null || typeof value.actionUrl === "string") &&
    (value.actionLabel === null || typeof value.actionLabel === "string") &&
    typeof value.createdAt === "string" && typeof value.publishedAt === "string" &&
    (value.status === undefined || value.status === "published")
  );
  return publicPosts.map((post) => ({
    id: String(post.id),
    title: String(post.title),
    content: String(post.content),
    excerpt: String(post.excerpt),
    category: String(post.category),
    image: String(post.image),
    actionUrl: typeof post.actionUrl === "string" ? post.actionUrl : null,
    actionLabel: typeof post.actionLabel === "string" ? post.actionLabel : null,
    mediaAssetId: typeof post.mediaAssetId === "string" ? post.mediaAssetId : null,
    linkHeaderAssetId: typeof post.linkHeaderAssetId === "string" ? post.linkHeaderAssetId : null,
    audioAssetId: typeof post.audioAssetId === "string" ? post.audioAssetId : null,
    videoAssetId: typeof post.videoAssetId === "string" ? post.videoAssetId : null,
    status: "published",
    deletedAt: null,
    createdAt: post.createdAt,
    updatedAt: post.publishedAt,
    linkHeaderUrl: typeof post.linkHeaderUrl === "string" ? post.linkHeaderUrl : null,
    audioUrl: typeof post.audioUrl === "string" ? post.audioUrl : null,
    videoUrl: typeof post.videoUrl === "string" ? post.videoUrl : null,
    viewCount: isFiniteNumber(post.viewCount) ? post.viewCount : 0,
  }));
}

export type MediaAssetRecord = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: "ready";
  altText: string | null;
  createdAt: string;
  url: string;
};

function isMediaAsset(value: unknown): value is MediaAssetRecord {
  return isRecord(value) && typeof value.id === "string" && typeof value.filename === "string" &&
    typeof value.mimeType === "string" && isFiniteNumber(value.sizeBytes) && value.status === "ready" &&
    (value.altText === null || typeof value.altText === "string") && typeof value.createdAt === "string" &&
    typeof value.url === "string";
}

export async function uploadMediaFile(file: File, altText = ""): Promise<MediaAssetRecord | null> {
  try {
    const reservation = await sendJson("/api/v1/admin/media/upload-url", "POST", {
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      ...(altText ? { altText } : {}),
    });
    if (!isRecord(reservation) || typeof reservation.assetId !== "string" || typeof reservation.uploadUrl !== "string") return null;
    const headers = isRecord(reservation.headers) && typeof reservation.headers["Content-Type"] === "string"
      ? { "Content-Type": reservation.headers["Content-Type"] }
      : { "Content-Type": file.type };
    const upload = await fetch(reservation.uploadUrl, { method: "PUT", headers, body: file });
    if (!upload.ok) return null;
    const confirmation = await sendJson(`/api/v1/admin/media/${encodeURIComponent(reservation.assetId)}/confirm`, "POST", {});
    return isRecord(confirmation) && isMediaAsset(confirmation.asset) ? confirmation.asset : null;
  } catch (error) {
    logError("admin", "Media upload failed", error);
    return null;
  }
}

export async function fetchMediaAssets(): Promise<MediaAssetRecord[] | null> {
  const payload = await getJson("/api/v1/admin/media?limit=100");
  return isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isMediaAsset) : null;
}

export async function deleteMediaAsset(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/media/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    return response.ok;
  } catch (error) {
    logError("admin", "Media delete failed", error);
    return false;
  }
}

export type PublicReview = { id: string; name: string; rating: number; comment: string; createdAt: string };

function isPublicReview(value: unknown): value is PublicReview {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" &&
    isFiniteNumber(value.rating) && typeof value.comment === "string" && typeof value.createdAt === "string";
}

export async function fetchPublicReviews(): Promise<PublicReview[] | null> {
  const payload = await getJson("/api/v1/public/reviews");
  return isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isPublicReview) : null;
}

export async function submitPublicReview(review: { name: string; rating: number; comment: string }): Promise<PublicReview | null> {
  const payload = await sendJson("/api/v1/public/reviews", "POST", review);
  return isRecord(payload) && isPublicReview(payload.review) ? payload.review : null;
}

const VISITOR_ID_KEY = "eye:visitor-id";

export function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function fetchCommunityMembership(name: string): Promise<{ joined: boolean; members: number } | null> {
  try {
    const params = new URLSearchParams({ visitorId: getVisitorId() });
    const payload = await getJson(`/api/v1/public/communities/${encodeURIComponent(name)}/membership?${params}`);
    return isRecord(payload) && typeof payload.joined === "boolean" && isFiniteNumber(payload.members)
      ? { joined: payload.joined, members: payload.members }
      : null;
  } catch (error) {
    logError("network", "Could not load community membership", error);
    return null;
  }
}

export async function setCommunityMembership(name: string, joined: boolean): Promise<{ joined: boolean; members: number } | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/public/communities/${encodeURIComponent(name)}/${joined ? "join" : "leave"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: getVisitorId() }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isRecord(payload) && typeof payload.joined === "boolean" && isFiniteNumber(payload.members)
      ? { joined: payload.joined, members: payload.members }
      : null;
  } catch (error) {
    logError("network", "Could not update community membership", error);
    return null;
  }
}

// Admin profile
export type AdminProfile = { id: string; email: string; name: string; createdAt: string };

export async function fetchAdminProfile(): Promise<AdminProfile | null> {
  const profile = await getJson("/api/v1/admin/profile");
  return isRecord(profile) && typeof profile.id === "string" && typeof profile.email === "string" &&
    typeof profile.name === "string" && typeof profile.createdAt === "string" ? profile as AdminProfile : null;
}

export async function updateAdminProfile(data: { name?: string; email?: string }): Promise<{ email: string; name: string } | null> {
  const result = await sendJson("/api/v1/admin/profile", "PATCH", data);
  return isRecord(result) && typeof result.email === "string" && typeof result.name === "string"
    ? { email: result.email, name: result.name }
    : null;
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<string | null> {
  const result = await sendJson("/api/v1/admin/profile/password", "POST", { currentPassword, newPassword });
  return isRecord(result) && typeof result.message === "string" ? result.message : null;
}

// Moderators
export type ModeratorRecord = { id: string; name: string; email: string; role: "Moderator" | "Administrator"; status: "Active" | "Invited" };

function isModerator(value: unknown): value is ModeratorRecord {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.email === "string" && ["Moderator", "Administrator"].includes(String(value.role)) &&
    ["Active", "Invited"].includes(String(value.status));
}

export async function fetchModerators(status?: string, limit = 100, offset = 0): Promise<ModeratorRecord[] | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  const payload = await getJson(`/api/v1/admin/moderators?${params}`);
  return isRecord(payload) && Array.isArray(payload.items) ? payload.items.filter(isModerator) : null;
}

export async function inviteModerator(member: { email: string; name?: string; role: ModeratorRecord["role"] }): Promise<ModeratorRecord | null> {
  const payload = await sendJson("/api/v1/admin/moderators", "POST", member);
  return isRecord(payload) && isModerator(payload.moderator) ? payload.moderator : null;
}

export async function updateModerator(id: string, update: Partial<Pick<ModeratorRecord, "name" | "role" | "status">>): Promise<ModeratorRecord | null> {
  const payload = await sendJson(`/api/v1/admin/moderators/${encodeURIComponent(id)}`, "PATCH", update);
  return isRecord(payload) && isModerator(payload.moderator) ? payload.moderator : null;
}

export async function deleteModerator(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/moderators/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
    return response.ok;
  } catch (error) {
    logError("admin", "deleteModerator failed", error);
    return false;
  }
}

export type AuditLogEntry = {
  id: string;
  actorEmail: string;
  method: string;
  path: string;
  resource: string;
  resourceId: string | null;
  action: string;
  statusCode: number;
  success: boolean;
  createdAt: string;
};

export type AuditLogResponse = {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
};

function isAuditLogEntry(value: unknown): value is AuditLogEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.actorEmail === "string" &&
    typeof value.method === "string" &&
    typeof value.path === "string" &&
    typeof value.resource === "string" &&
    (value.resourceId === null || typeof value.resourceId === "string") &&
    typeof value.action === "string" &&
    isFiniteNumber(value.statusCode) &&
    typeof value.success === "boolean" &&
    typeof value.createdAt === "string"
  );
}

// Audit log
export async function fetchAuditLog(
  limit = 50,
  resource?: string,
  offset = 0,
): Promise<AuditLogResponse | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (resource) params.set("resource", resource);
  const payload = await getJson(`/api/v1/admin/audit?${params}`);
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    !isFiniteNumber(payload.total) ||
    !isFiniteNumber(payload.limit) ||
    !isFiniteNumber(payload.offset)
  ) {
    return null;
  }

  return {
    items: payload.items.filter(isAuditLogEntry),
    total: payload.total,
    limit: payload.limit,
    offset: payload.offset,
  };
}

// ---------- Public content API (Exploor landing page) ----------

export type PublicCategory = { name: string; count: number };

function isPublicCategory(value: unknown): value is PublicCategory {
  return isRecord(value) && typeof value.name === "string" && isFiniteNumber(value.count);
}

export async function fetchPublicCategories(): Promise<PublicCategory[] | null> {
  const payload = await getJson("/api/v1/public/posts/categories");
  return isRecord(payload) && Array.isArray(payload.items)
    ? payload.items.filter(isPublicCategory)
    : null;
}

export async function fetchPopularPosts(limit = 4): Promise<PostRecord[] | null> {
  const payload = await getJson(`/api/v1/public/posts/popular?limit=${limit}`);
  return isRecord(payload) && Array.isArray(payload.items)
    ? payload.items.filter(isPostRecord)
    : null;
}

export async function fetchTrendingPosts(limit = 5): Promise<PostRecord[] | null> {
  const payload = await getJson(`/api/v1/public/posts/trending?limit=${limit}`);
  return isRecord(payload) && Array.isArray(payload.items)
    ? payload.items.filter(isPostRecord)
    : null;
}

// Fire-and-forget read ping. The backend dedupes per visitor, so this can be
// called on every story page load without inflating the counters.
export async function pingPostView(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/public/posts/${encodeURIComponent(id)}/view`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: getVisitorId() }),
    });
  } catch (error) {
    logError("network", "Could not ping post view", error);
  }
}

export type AuthorProfile = {
  name: string;
  role: string;
  bio: string;
  email: string;
  avatarUrl: string | null;
};

function isAuthorProfile(value: unknown): value is AuthorProfile {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.role === "string" &&
    typeof value.bio === "string" &&
    typeof value.email === "string" &&
    (value.avatarUrl === null || typeof value.avatarUrl === "string")
  );
}

export async function fetchAuthorProfile(): Promise<AuthorProfile | null> {
  const payload = await getJson("/api/v1/public/author");
  return isAuthorProfile(payload) ? payload : null;
}

export async function submitContactMessage(data: {
  name: string;
  email: string;
  subject?: string;
  message: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/public/contact`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    if (!response.ok) {
      return { ok: false, message: payload.message || "Message could not be sent. Try again." };
    }
    return { ok: true, message: payload.message || "Message received. We will reply by email." };
  } catch (error) {
    logError("network", "Contact request failed", error);
    return { ok: false, message: "Message could not be sent. Try again." };
  }
}

// ---------- Admin: contact messages inbox ----------

function isContactMessage(value: unknown): value is AdminContactMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.subject === "string" &&
    typeof value.message === "string" &&
    typeof value.handled === "boolean" &&
    typeof value.createdAt === "string"
  );
}

export async function fetchAdminMessages(
  limit = 20,
  offset = 0,
  handled?: boolean,
): Promise<{ items: AdminContactMessage[]; total: number; unread: number } | null> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (handled !== undefined) params.set("handled", String(handled));
  const payload = await getJson(`/api/v1/admin/messages?${params}`);
  if (!isRecord(payload) || !Array.isArray(payload.items) || !isFiniteNumber(payload.total)) return null;
  return {
    items: payload.items.filter(isContactMessage),
    total: payload.total,
    unread: isFiniteNumber(payload.unread) ? payload.unread : 0,
  };
}

export async function setMessageHandled(id: string, handled = true): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/messages/${encodeURIComponent(id)}/handled`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handled }),
    });
    return response.ok;
  } catch (error) {
    logError("admin", "Could not update the message", error);
    return false;
  }
}

export async function deleteAdminMessage(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    return response.ok;
  } catch (error) {
    logError("admin", "Could not delete the message", error);
    return false;
  }
}

// ---------- Admin: public author profile editor ----------

function isAdminAuthorProfile(value: unknown): value is AdminAuthorProfile {
  return isAuthorProfile(value);
}

export async function fetchAdminAuthorProfile(): Promise<AdminAuthorProfile | null> {
  const payload = await getJson("/api/v1/admin/author");
  return isAdminAuthorProfile(payload) ? payload : null;
}

export async function updateAdminAuthorProfile(
  data: { name: string; role: string; bio: string; email: string; avatarUrl: string | null },
): Promise<AdminAuthorProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/admin/author`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as unknown;
    return isAdminAuthorProfile(payload) ? payload : null;
  } catch (error) {
    logError("admin", "Could not save the author profile", error);
    return null;
  }
}
