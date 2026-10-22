import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { requireAuth } from "./auth.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { cache } from "./lib/cache.js";
import { logger } from "./lib/logger.js";
import { config } from "./config.js";
import bcrypt from "bcryptjs";
import { refreshSessionCookie } from "./auth.js";

// Every route below is admin-only. requireAuth runs first, then a generous
// per-minute cap so a runaway dashboard tab cannot hammer the database.
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
  store: createRateLimitStore("rl:admin:"),
});

// Aggregates are cheap but not free; a short TTL keeps a polling dashboard from
// re-running the same scans every few seconds.
const INSIGHTS_TTL_SECONDS = 30;
const ACTIVITY_TTL_SECONDS = 30;

// Query strings arrive as strings, so "false" must not coerce to true.
const boolFromQuery = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true" || value === "1");

const activityQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(14),
});

const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: boolFromQuery,
});

const idSchema = z.string().min(1).max(64);

// Express 4 does not forward rejected promises to error middleware, so an async
// handler that throws would hang the request. Wrap every route so a database
// outage becomes a clean 500 instead.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Sensitive field patterns that should never be logged in audit trail
const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /hash/i,
  /authorization/i,
  /apikey/i,
  /api_key/i,
  /private/i,
  /credential/i,
];

function isSensitiveField(fieldName) {
  return SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
}

export const adminRouter = Router();

adminRouter.use(requireAuth, adminLimiter);

// Record authenticated admin mutations after the response completes. Only
// field names are stored from request bodies; credentials and user content
// never enter the audit trail. Audit failures never block the admin action.
adminRouter.use((req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();

  const pathParts = req.path.split("/").filter(Boolean);
  const resource = (pathParts[0] || "unknown").replace(/s$/, "");
  const verb = { POST: "create", PATCH: "update", PUT: "replace", DELETE: "delete" }[req.method];
  const action = `${resource}.${verb}`;
  const changedFields =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? Object.keys(req.body).filter(key => !isSensitiveField(key)).slice(0, 50)
      : [];

  res.on("finish", () => {
    const statusCode = res.statusCode;
    prisma.auditLog
      .create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "unknown",
          method: req.method,
          path: req.path,
          resource,
          resourceId: req.params?.id || null,
          action,
          statusCode,
          success: statusCode < 400,
          meta: changedFields.length ? { changedFields } : undefined,
        },
      })
      .catch((error) => {
        logger.error({ err: error.message, action }, "[eye:admin] audit log write failed");
      });
  });

  next();
});

// GET /api/v1/admin/audit?limit=50&offset=0&resource=post - read the audit trail.
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  resource: z.string().trim().min(1).max(64).optional(),
});

adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid query.' });
    const { limit, offset, resource } = parsed.data;
    const where = resource ? { resource } : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ items, total, limit, offset });
  }),
);



// GET /api/v1/admin/metrics - headline counts for the overview cards.
adminRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    const [posts, stories, subscribers, chatMessages, reviews, unreadNotifications] =
      await Promise.all([
        prisma.post.count({ where: { deletedAt: null } }),
        prisma.story.count(),
        prisma.newsletterSubscriber.count(),
        prisma.chatMessage.count(),
        prisma.review.count(),
        prisma.notification.count({ where: { read: false } }),
      ]);

    res.json({ posts, stories, subscribers, chatMessages, reviews, unreadNotifications });
  }),
);

// GET /api/v1/admin/insights - totals, recent windows and top communities.
adminRouter.get(
  "/insights",
  asyncHandler(async (_req, res) => {
    const cached = await cache.get("admin:insights");
    if (cached) return res.json(cached);

    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      subscribersTotal,
      subscribers7,
      subscribers30,
      chatTotal,
      chat7,
      chat30,
      reviewsTotal,
      reviewAggregate,
      postsTotal,
      topCommunities,
    ] = await Promise.all([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.count({ where: { subscribedAt: { gte: since7 } } }),
      prisma.newsletterSubscriber.count({ where: { subscribedAt: { gte: since30 } } }),
      prisma.chatMessage.count(),
      prisma.chatMessage.count({ where: { createdAt: { gte: since7 } } }),
      prisma.chatMessage.count({ where: { createdAt: { gte: since30 } } }),
      prisma.review.count(),
      prisma.review.aggregate({ _avg: { rating: true } }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.$queryRaw`
        SELECT c."name" AS name, COUNT(m."id")::int AS messages
        FROM "ChatMessage" m
        JOIN "Community" c ON c."id" = m."communityId"
        GROUP BY c."name"
        ORDER BY messages DESC
        LIMIT 5
      `,
    ]);

    const payload = {
      subscribers: { total: subscribersTotal, last7Days: subscribers7, last30Days: subscribers30 },
      chat: { total: chatTotal, last7Days: chat7, last30Days: chat30 },
      reviews: {
        total: reviewsTotal,
        averageRating: reviewAggregate._avg.rating
          ? Math.round(reviewAggregate._avg.rating * 10) / 10
          : 0,
      },
      posts: { total: postsTotal },
      topCommunities: topCommunities.map((row) => ({
        name: row.name,
        messages: Number(row.messages),
      })),
    };

    await cache.set("admin:insights", payload, INSIGHTS_TTL_SECONDS);
    res.json(payload);
  }),
);

// GET /api/v1/admin/activity?days=14 - per-day counts for the flow chart.
adminRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const parsed = activityQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid query." });
    const { days } = parsed.data;

    const cacheKey = `admin:activity:${days}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json(cached);

    // generate_series guarantees a row per day (including empty days) so the
    // chart never has gaps. Counts are cast to int so they arrive as numbers.
    const rows = await prisma.$queryRaw`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
             COALESCE(s.count, 0)::int AS subscribers,
             COALESCE(c.count, 0)::int AS chat,
             COALESCE(r.count, 0)::int AS reviews
      FROM generate_series(
             date_trunc('day', now()) - (${days}::int - 1) * interval '1 day',
             date_trunc('day', now()),
             interval '1 day'
           ) AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', "subscribedAt") AS day, COUNT(*) AS count
        FROM "NewsletterSubscriber"
        WHERE "subscribedAt" >= date_trunc('day', now()) - (${days}::int - 1) * interval '1 day'
        GROUP BY 1
      ) s ON s.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
        FROM "ChatMessage"
        WHERE "createdAt" >= date_trunc('day', now()) - (${days}::int - 1) * interval '1 day'
        GROUP BY 1
      ) c ON c.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
        FROM "Review"
        WHERE "createdAt" >= date_trunc('day', now()) - (${days}::int - 1) * interval '1 day'
        GROUP BY 1
      ) r ON r.day = d.day
      ORDER BY d.day
    `;

    const payload = {
      days,
      series: rows.map((row) => ({
        date: row.date,
        subscribers: Number(row.subscribers),
        chat: Number(row.chat),
        reviews: Number(row.reviews),
      })),
    };

    await cache.set(cacheKey, payload, ACTIVITY_TTL_SECONDS);
    res.json(payload);
  }),
);

// GET /api/v1/admin/notifications?limit=20&unreadOnly=false
adminRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const parsed = notificationsQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid query." });
    const { limit, unreadOnly } = parsed.data;

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: unreadOnly ? { read: false } : {},
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { read: false } }),
    ]);

    res.json({ notifications, unread });
  }),
);

// POST /api/v1/admin/notifications/read-all
adminRouter.post(
  "/notifications/read-all",
  asyncHandler(async (_req, res) => {
    const result = await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    res.json({ ok: true, updated: result.count });
  }),
);

// POST /api/v1/admin/notifications/:id/read
adminRouter.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) return res.status(400).json({ message: "Invalid id." });

    // updateMany (not update) so a stale id is a no-op instead of a 500.
    const result = await prisma.notification.updateMany({
      where: { id: parsed.data },
      data: { read: true },
    });
    res.json({ ok: true, updated: result.count });
  }),
);

// POSTS CRUD
const postQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["draft", "published", "scheduled", "trash"]).optional(),
});

const postCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(400).optional(),
  category: z.string().min(1).max(80).optional(),
  image: z.string().max(2048).optional(),
  mediaAssetId: z.string().min(1).max(64).nullable().optional(),
  linkHeaderAssetId: z.string().min(1).max(64).nullable().optional(),
  audioAssetId: z.string().min(1).max(64).nullable().optional(),
  videoAssetId: z.string().min(1).max(64).nullable().optional(),
  linkHeaderUrl: z.string().url().max(2048).nullable().optional(),
  audioUrl: z.string().url().max(2048).nullable().optional(),
  videoUrl: z.string().url().max(2048).nullable().optional(),
  actionUrl: z.string().url().max(2048).nullable().optional(),
  actionLabel: z.string().max(80).nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
});

const postUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  excerpt: z.string().max(400).optional(),
  category: z.string().min(1).max(80).optional(),
  image: z.string().max(2048).optional(),
  mediaAssetId: z.string().min(1).max(64).nullable().optional(),
  linkHeaderAssetId: z.string().min(1).max(64).nullable().optional(),
  audioAssetId: z.string().min(1).max(64).nullable().optional(),
  videoAssetId: z.string().min(1).max(64).nullable().optional(),
  linkHeaderUrl: z.string().url().max(2048).nullable().optional(),
  audioUrl: z.string().url().max(2048).nullable().optional(),
  videoUrl: z.string().url().max(2048).nullable().optional(),
  actionUrl: z.string().url().max(2048).nullable().optional(),
  actionLabel: z.string().max(80).nullable().optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
});

adminRouter.get(
  '/posts',
  asyncHandler(async (req, res) => {
    const parsed = postQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid query.' });
    const { search, limit, offset } = parsed.data;

    const where = {
      deletedAt: parsed.data.status === "trash" ? { not: null } : null,
      ...(parsed.data.status && parsed.data.status !== "trash" ? { status: parsed.data.status } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.post.findMany({ where, orderBy: { updatedAt: "desc" }, take: limit, skip: offset }),
      prisma.post.count({ where }),
    ]);

    res.json({ items, total });
  }),
);

adminRouter.post(
  '/posts',
  asyncHandler(async (req, res) => {
    const parsed = postCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body.' });
    const { status, ...fields } = parsed.data;
    const assetIds = [fields.mediaAssetId, fields.linkHeaderAssetId, fields.audioAssetId, fields.videoAssetId].filter(Boolean);
    if (assetIds.length) {
      const readyAssets = await prisma.mediaAsset.count({ where: { id: { in: assetIds }, status: "ready" } });
      if (readyAssets !== new Set(assetIds).size) return res.status(400).json({ message: "One or more selected media assets are not available." });
    }
    const post = await prisma.post.create({
      data: { ...fields, status, publishedAt: status === "published" ? new Date() : null },
    });
    res.status(201).json(post);
  }),
);

adminRouter.patch(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Invalid id.' });
    const parsedBody = postUpdateSchema.safeParse(req.body);
    if (!parsedBody.success) return res.status(400).json({ message: 'Invalid body.' });

    const existing = await prisma.post.findFirst({ where: { id: parsedId.data, deletedAt: null } });
    if (!existing) return res.status(404).json({ message: "Post not found." });
    const data = { ...parsedBody.data };
    if (data.status === "published" && !existing.publishedAt) data.publishedAt = new Date();
    const assetIds = [data.mediaAssetId, data.linkHeaderAssetId, data.audioAssetId, data.videoAssetId].filter(Boolean);
    if (assetIds.length) {
      const readyAssets = await prisma.mediaAsset.count({ where: { id: { in: assetIds }, status: "ready" } });
      if (readyAssets !== new Set(assetIds).size) return res.status(400).json({ message: "One or more selected media assets are not available." });
    }
    const post = await prisma.post.update({ where: { id: parsedId.data }, data });
    res.json(post);
  }),
);

adminRouter.delete(
  '/posts/:id',
  asyncHandler(async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: 'Invalid id.' });

    const result = await prisma.post.updateMany({
      where: { id: parsedId.data, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ message: "Post not found." });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  "/posts/:id/restore",
  asyncHandler(async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: "Invalid id." });
    const result = await prisma.post.updateMany({
      where: { id: parsedId.data, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (!result.count) return res.status(404).json({ message: "Trashed post not found." });
    const post = await prisma.post.findUnique({ where: { id: parsedId.data } });
    res.json(post);
  }),
);

// ADMIN PROFILE
const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

adminRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await prisma.adminProfile.upsert({
      where: { email: req.user.email },
      create: {
        email: req.user.email,
        name: req.user.email.split("@")[0] || "Administrator",
        passwordHash: req.user.email === config.adminEmail ? config.adminPasswordHash || null : null,
      },
      update: {},
      select: { id: true, email: true, name: true, createdAt: true },
    });
    res.json(profile);
  }),
);

adminRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid body.' });
    if (!Object.keys(parsed.data).length) return res.status(400).json({ message: "Provide a name or email to update." });
    const current = await prisma.adminProfile.upsert({
      where: { email: req.user.email },
      create: {
        email: req.user.email,
        name: req.user.email.split("@")[0] || "Administrator",
        passwordHash: req.user.email === config.adminEmail ? config.adminPasswordHash || null : null,
      },
      update: {},
    });
    const profile = await prisma.adminProfile.update({ where: { id: current.id }, data: parsed.data });
    if (profile.email !== req.user.email) {
      if (!profile.passwordHash && req.user.email === config.adminEmail && config.adminPasswordHash) {
        await prisma.adminProfile.update({
          where: { id: profile.id },
          data: { passwordHash: config.adminPasswordHash },
        });
      }
      refreshSessionCookie(res, { id: profile.id, email: profile.email });
    }
    res.json({ id: profile.id, email: profile.email, name: profile.name });
  }),
);

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
});

adminRouter.post(
  "/profile/password",
  asyncHandler(async (req, res) => {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Use a new password between 12 and 128 characters." });
    const { currentPassword, newPassword } = parsed.data;
    const profile = await prisma.adminProfile.findUnique({ where: { email: req.user.email } });
    const user = await prisma.user.findUnique({ where: { email: req.user.email } });
    const passwordHash = profile?.passwordHash ?? user?.passwordHash ??
      (req.user.email === config.adminEmail ? config.adminPasswordHash : "");
    if (!passwordHash) return res.status(400).json({ message: "Password changes are unavailable for an environment-only admin account." });
    if (!(await bcrypt.compare(currentPassword, passwordHash))) {
      return res.status(403).json({ message: "Current password is incorrect." });
    }
    const nextHash = await bcrypt.hash(newPassword, 12);
    if (profile) {
      await prisma.adminProfile.update({ where: { id: profile.id }, data: { passwordHash: nextHash } });
    } else {
      await prisma.adminProfile.create({
        data: { email: req.user.email, name: user?.name || req.user.email.split("@")[0], passwordHash: nextHash },
      });
    }
    res.json({ ok: true, message: "Password updated. Sign in with your new password next time." });
  }),
);

// MODERATOR MANAGEMENT
const moderatorQuerySchema = z.object({
  status: z.enum(["Invited", "Active"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

adminRouter.get(
  '/moderators',
  asyncHandler(async (req, res) => {
    const parsed = moderatorQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid query.' });
    const where = parsed.data.status ? { status: parsed.data.status } : {};
    const [items, total] = await Promise.all([
      prisma.moderator.findMany({ where, orderBy: { createdAt: 'desc' }, take: parsed.data.limit, skip: parsed.data.offset }),
      prisma.moderator.count({ where }),
    ]);
    res.json({ items, total });
  }),
);

const moderatorCreateSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["Moderator", "Administrator"]).default("Moderator"),
});

adminRouter.post(
  "/moderators",
  asyncHandler(async (req, res) => {
    const parsed = moderatorCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Enter a valid email, name, and role." });
    const email = parsed.data.email.trim().toLowerCase();
    const name = parsed.data.name?.trim() || email.split("@")[0];
    const moderator = await prisma.moderator.create({
      data: { email, name, role: parsed.data.role, status: "Invited" },
    });
    res.status(201).json({ moderator, message: "Invite saved. Email delivery is not configured." });
  }),
);

adminRouter.patch(
  "/moderators/:id",
  asyncHandler(async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    const parsedBody = z.object({
      name: z.string().trim().min(1).max(100).optional(),
      role: z.enum(["Moderator", "Administrator"]).optional(),
      status: z.enum(["Invited", "Active"]).optional(),
    }).safeParse(req.body);
    if (!parsedId.success || !parsedBody.success || !Object.keys(parsedBody.data).length) {
      return res.status(400).json({ message: "Invalid moderator update." });
    }
    const moderator = await prisma.moderator.update({ where: { id: parsedId.data }, data: parsedBody.data });
    res.json({ moderator });
  }),
);

adminRouter.delete(
  "/moderators/:id",
  asyncHandler(async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ message: "Invalid id." });
    const result = await prisma.moderator.deleteMany({ where: { id: parsedId.data } });
    if (!result.count) return res.status(404).json({ message: "Moderator not found." });
    res.json({ ok: true });
  }),
);

// Surface unexpected failures as JSON without leaking internals.
adminRouter.use((error, _req, res, _next) => {
  logger.error({ err: error.message }, "[eye:admin] request failed");
  res.status(500).json({ message: "Something went wrong." });
});
