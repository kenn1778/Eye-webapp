import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { requireAuth } from "./auth.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { cache } from "./lib/cache.js";
import { logger } from "./lib/logger.js";

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

export const adminRouter = Router();

adminRouter.use(requireAuth, adminLimiter);

// GET /api/v1/admin/metrics - headline counts for the overview cards.
adminRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    const [posts, stories, subscribers, chatMessages, reviews, unreadNotifications] =
      await Promise.all([
        prisma.post.count(),
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
      prisma.post.count(),
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

// Surface unexpected failures as JSON without leaking internals.
adminRouter.use((error, _req, res, _next) => {
  logger.error({ err: error.message }, "[eye:admin] request failed");
  res.status(500).json({ message: "Something went wrong." });
});
