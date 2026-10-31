import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { publicMediaPath } from "./lib/s3.js";
import { config } from "./config.js";
import { enqueue } from "./lib/queue.js";
import { createNotification, maskEmail } from "./lib/notifications.js";

// Express 4 does not forward rejected promises to error middleware, so an async
// handler that throws would hang the request. Wrap every route so a database
// outage becomes a clean 500 instead.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export const publicRouter = Router();

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:reviews:"),
});

// View pings are cheap but high-volume; cap per IP while the per-visitor
// dedupe in PostView keeps refreshes from inflating counters.
const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:views:"),
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:contact:"),
});

const visitorIdSchema = z.string().uuid();
const reviewSchema = z.object({
  name: z.string().trim().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(400),
});

// Published public content only; trashed and draft entries never leak here.
const publicPostSelect = {
  id: true,
  title: true,
  content: true,
  excerpt: true,
  category: true,
  image: true,
  actionUrl: true,
  actionLabel: true,
  mediaAssetId: true,
  linkHeaderAssetId: true,
  audioAssetId: true,
  videoAssetId: true,
  linkHeaderUrl: true,
  audioUrl: true,
  videoUrl: true,
  publishedAt: true,
  createdAt: true,
  viewCount: true,
};

// S3-backed media is referenced by asset id; resolve it to the public URL.
const shapePost = (post) => ({
  ...post,
  image: post.mediaAssetId ? publicMediaPath(post.mediaAssetId) : post.image,
  linkHeaderUrl: post.linkHeaderAssetId ? publicMediaPath(post.linkHeaderAssetId) : post.linkHeaderUrl,
  audioUrl: post.audioAssetId ? publicMediaPath(post.audioAssetId) : post.audioUrl,
  videoUrl: post.videoAssetId ? publicMediaPath(post.videoAssetId) : post.videoUrl,
});

const parseLimit = (req, fallback, max = 20) => {
  const parsed = Number.parseInt(String(req.query.limit ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

publicRouter.get("/posts", asyncHandler(async (req, res) => {
  // Optional server-side filters. "All stories" is the UI's sentinel for "no
  // category filter", so it is treated as absent here.
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 60) : "";
  const where = { status: "published", deletedAt: null };
  if (category && category !== "All stories") where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }
  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: publicPostSelect,
  });
  res.set("Cache-Control", "no-store");
  res.json({ items: posts.map(shapePost) });
}));

// Category tiles for the public discovery band.
publicRouter.get("/posts/categories", asyncHandler(async (_req, res) => {
  const grouped = await prisma.post.groupBy({
    by: ["category"],
    where: { status: "published", deletedAt: null },
    _count: { category: true },
    orderBy: { _count: { category: "desc" } },
  });
  res.set("Cache-Control", "no-store");
  res.json({ items: grouped.map((group) => ({ name: group.category, count: group._count.category })) });
}));

// Most-read stories. Zero-view posts still appear (ordered by recency), so the
// sidebar is never empty on a fresh deployment.
publicRouter.get("/posts/popular", asyncHandler(async (req, res) => {
  const limit = parseLimit(req, 5);
  const posts = await prisma.post.findMany({
    where: { status: "published", deletedAt: null },
    orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: publicPostSelect,
  });
  res.set("Cache-Control", "no-store");
  res.json({ items: posts.map(shapePost) });
}));

// Trending = most view events in the last 7 days. Empty window falls back to
// an empty list; the UI keeps its recency-based fallback in that case.
publicRouter.get("/posts/trending", asyncHandler(async (req, res) => {
  const limit = parseLimit(req, 5);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.postView.groupBy({
    by: ["postId"],
    where: { createdAt: { gte: since } },
    _count: { postId: true },
    orderBy: { _count: { postId: "desc" } },
    take: limit,
  });
  const ids = grouped.map((group) => group.postId);
  if (ids.length === 0) return res.json({ items: [] });
  const posts = await prisma.post.findMany({
    where: { id: { in: ids }, status: "published", deletedAt: null },
    select: publicPostSelect,
  });
  const byId = new Map(posts.map((post) => [post.id, post]));
  res.set("Cache-Control", "no-store");
  res.json({ items: grouped.map((group) => byId.get(group.postId)).filter(Boolean).map(shapePost) });
}));

// Fire-and-forget view ping. Identified visitors are deduped by the
// (postId, visitorId) unique constraint; anonymous pings always count.
const viewSchema = z.object({ visitorId: z.string().uuid().optional() });

publicRouter.post("/posts/:id/view", viewLimiter, asyncHandler(async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, status: "published", deletedAt: null },
    select: { id: true, viewCount: true },
  });
  if (!post) return res.status(404).json({ message: "Post not found" });
  const parsed = viewSchema.safeParse(req.body ?? {});
  const visitorId = parsed.success ? parsed.data.visitorId ?? null : null;
  let counted = true;
  try {
    await prisma.postView.create({ data: { postId: post.id, visitorId } });
  } catch (error) {
    if (error?.code === "P2002") counted = false;
    else throw error;
  }
  let views = post.viewCount;
  if (counted) {
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    views = updated.viewCount;
  }
  res.set("Cache-Control", "no-store");
  res.json({ counted, views });
}));

publicRouter.get("/posts/:id", asyncHandler(async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, status: "published", deletedAt: null },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      category: true,
      image: true,
      actionUrl: true,
      actionLabel: true,
      mediaAssetId: true,
      linkHeaderAssetId: true,
      audioAssetId: true,
      videoAssetId: true,
      linkHeaderUrl: true,
      audioUrl: true,
      videoUrl: true,
      publishedAt: true,
      createdAt: true,
    },
  });
  if (!post) return res.status(404).json({ message: "Post not found" });
  res.set("Cache-Control", "no-store");
  res.json({
    ...post,
    image: post.mediaAssetId ? publicMediaPath(post.mediaAssetId) : post.image,
    linkHeaderUrl: post.linkHeaderAssetId ? publicMediaPath(post.linkHeaderAssetId) : post.linkHeaderUrl,
    audioUrl: post.audioAssetId ? publicMediaPath(post.audioAssetId) : post.audioUrl,
    videoUrl: post.videoAssetId ? publicMediaPath(post.videoAssetId) : post.videoUrl,
  });
}));

publicRouter.get("/reviews", asyncHandler(async (_req, res) => {
  const items = await prisma.review.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, rating: true, comment: true, createdAt: true },
  });
  res.set("Cache-Control", "no-store");
  res.json({ items: items.map((review) => ({ ...review, comment: review.comment ?? "" })) });
}));

publicRouter.post("/reviews", reviewLimiter, asyncHandler(async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a name, a 1–5 star rating, and a review of 5–400 characters." });

  const review = await prisma.review.create({
    data: { ...parsed.data, published: true },
    select: { id: true, name: true, rating: true, comment: true, createdAt: true },
  });
  res.status(201).json({ review });
}));

// Visitor ids are random UUIDs stored in localStorage. They identify the
// visitor's join state without collecting an email or requiring an account.
publicRouter.get("/communities/:name/membership", asyncHandler(async (req, res) => {
  const parsed = visitorIdSchema.safeParse(req.query.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  const community = await prisma.community.findUnique({
    where: { name: req.params.name },
    select: { id: true },
  });
  if (!community) return res.json({ joined: false, members: 0 });
  const [membership, members] = await Promise.all([
    prisma.communityMembership.findUnique({
      where: { visitorId_communityId: { visitorId: parsed.data, communityId: community.id } },
      select: { id: true },
    }),
    prisma.communityMembership.count({ where: { communityId: community.id } }),
  ]);
  res.json({ joined: Boolean(membership), members });
}));

publicRouter.post("/communities/:name/join", asyncHandler(async (req, res) => {
  const parsed = visitorIdSchema.safeParse(req.body?.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  const community = await prisma.community.upsert({
    where: { name: req.params.name },
    update: {},
    create: { name: req.params.name },
    select: { id: true },
  });
  await prisma.communityMembership.upsert({
    where: { visitorId_communityId: { visitorId: parsed.data, communityId: community.id } },
    update: {},
    create: { visitorId: parsed.data, communityId: community.id },
  });
  const members = await prisma.communityMembership.count({ where: { communityId: community.id } });
  res.json({ joined: true, members });
}));

publicRouter.post("/communities/:name/leave", asyncHandler(async (req, res) => {
  const parsed = visitorIdSchema.safeParse(req.body?.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  const community = await prisma.community.findUnique({ where: { name: req.params.name }, select: { id: true } });
  if (!community) return res.json({ joined: false, members: 0 });
  await prisma.communityMembership.deleteMany({
    where: { visitorId: parsed.data, communityId: community.id },
  });
  const members = await prisma.communityMembership.count({ where: { communityId: community.id } });
  res.json({ joined: false, members });
}));

// Public author card. The row is created on first read so a future admin
// editor can update it without another deploy.
publicRouter.get("/author", asyncHandler(async (_req, res) => {
  let profile = await prisma.authorProfile.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profile) {
    profile = await prisma.authorProfile.create({
      data: {
        name: process.env.AUTHOR_NAME ?? "Alozie Izuchukwu Johnkennedy",
        role: "Founder and editor",
        bio: "Writes about scholarships, first jobs, and building a career on your own terms.",
        email: config.adminEmail || "teckennedy177@gmail.com",
      },
    });
  }
  res.set("Cache-Control", "no-store");
  res.json({
    name: profile.name,
    role: profile.role,
    bio: profile.bio,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  });
}));

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(10).max(2000),
});

publicRouter.post("/contact", contactLimiter, asyncHandler(async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter your name, a valid email, and a message of 10-2000 characters." });
  }
  const data = parsed.data;
  const created = await prisma.contactMessage.create({
    data: { name: data.name, email: data.email, subject: data.subject, message: data.message },
    select: { id: true, createdAt: true },
  });
  // Dashboard feed + optional email forward. Both are side effects: a failure
  // must not fail the request that already stored the message.
  createNotification({
    type: "system",
    title: "New contact message",
    body: data.subject || data.message.slice(0, 120),
    actor: `${data.name} (${maskEmail(data.email)})`,
  });
  if (config.adminEmail) {
    enqueue("email.send", {
      to: config.adminEmail,
      subject: `EYE contact: ${data.subject || "general enquiry"}`,
      text: `From: ${data.name} <${data.email}>\n\n${data.message}`,
      tag: "contact",
    });
  }
  res.status(201).json({ id: created.id, message: "Message received. We will reply by email." });
}));
