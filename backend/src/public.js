import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { publicMediaPath } from "./lib/s3.js";

export const publicRouter = Router();

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:reviews:"),
});

const visitorIdSchema = z.string().uuid();
const reviewSchema = z.object({
  name: z.string().trim().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(400),
});

// Published public content only; trashed and draft entries never leak here.
publicRouter.get("/posts", async (_req, res, next) => {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "published", deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
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
    res.set("Cache-Control", "no-store");
    res.json({ items: posts.map((post) => ({
      ...post,
      image: post.mediaAssetId ? publicMediaPath(post.mediaAssetId) : post.image,
      linkHeaderUrl: post.linkHeaderAssetId ? publicMediaPath(post.linkHeaderAssetId) : post.linkHeaderUrl,
      audioUrl: post.audioAssetId ? publicMediaPath(post.audioAssetId) : post.audioUrl,
      videoUrl: post.videoAssetId ? publicMediaPath(post.videoAssetId) : post.videoUrl,
    })) });
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/reviews", async (_req, res, next) => {
  try {
    const items = await prisma.review.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, rating: true, comment: true, createdAt: true },
    });
    res.set("Cache-Control", "no-store");
    res.json({ items: items.map((review) => ({ ...review, comment: review.comment ?? "" })) });
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/reviews", reviewLimiter, async (req, res, next) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Enter a name, a 1–5 star rating, and a review of 5–400 characters." });

  try {
    const review = await prisma.review.create({
      data: { ...parsed.data, published: true },
      select: { id: true, name: true, rating: true, comment: true, createdAt: true },
    });
    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});

// Visitor ids are random UUIDs stored in localStorage. They identify the
// visitor's join state without collecting an email or requiring an account.
publicRouter.get("/communities/:name/membership", async (req, res, next) => {
  const parsed = visitorIdSchema.safeParse(req.query.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  try {
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
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/communities/:name/join", async (req, res, next) => {
  const parsed = visitorIdSchema.safeParse(req.body?.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  try {
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
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/communities/:name/leave", async (req, res, next) => {
  const parsed = visitorIdSchema.safeParse(req.body?.visitorId);
  if (!parsed.success) return res.status(400).json({ message: "A valid visitor id is required." });
  try {
    const community = await prisma.community.findUnique({ where: { name: req.params.name }, select: { id: true } });
    if (!community) return res.json({ joined: false, members: 0 });
    await prisma.communityMembership.deleteMany({
      where: { visitorId: parsed.data, communityId: community.id },
    });
    const members = await prisma.communityMembership.count({ where: { communityId: community.id } });
    res.json({ joined: false, members });
  } catch (error) {
    next(error);
  }
});