import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "./lib/prisma.js";
import { requireAuth } from "./auth.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { config } from "./config.js";
import { mediaStorageEnabled, publicMediaPath, s3 } from "./lib/s3.js";
import { logger } from "./lib/logger.js";

const MAX_FILE_SIZE = 200 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
  "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "application/pdf",
]);
const fileSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().max(120),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE),
  altText: z.string().trim().max(300).optional(),
});
const mediaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("rl:media:"),
});
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function requireMediaStorage(_req, res, next) {
  if (!mediaStorageEnabled) return res.status(503).json({ message: "S3 media storage is not configured." });
  next();
}

function assetResponse(asset) {
  return {
    id: asset.id,
    filename: asset.originalName,
    mimeType: asset.mimeType,
    sizeBytes: Number(asset.sizeBytes),
    status: asset.status,
    altText: asset.altText,
    createdAt: asset.createdAt,
    url: publicMediaPath(asset.id),
  };
}

async function signedAssetUrl(objectKey, mimeType) {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: config.s3MediaBucket,
    Key: objectKey,
    ResponseContentType: mimeType,
    ResponseContentDisposition: "inline",
  }), { expiresIn: 300 });
}

export const mediaAdminRouter = Router();
mediaAdminRouter.use(requireAuth, mediaLimiter, requireMediaStorage);

// Reserve a database record and return a short-lived presigned PUT URL. The
// browser uploads bytes directly to S3; the bucket remains private.
mediaAdminRouter.post("/upload-url", asyncHandler(async (req, res) => {
  const parsed = fileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid file details. Supported media up to 200 MB." });
  if (!allowedMimeTypes.has(parsed.data.mimeType.toLowerCase())) {
    return res.status(415).json({ message: "That file type is not supported." });
  }

  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
  const objectKey = `media/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const asset = await prisma.mediaAsset.create({
    data: {
      objectKey,
      originalName: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: BigInt(parsed.data.sizeBytes),
      altText: parsed.data.altText,
      uploadedBy: req.user.email,
      status: "pending",
    },
  });
  const command = new PutObjectCommand({
    Bucket: config.s3MediaBucket,
    Key: objectKey,
    ContentType: parsed.data.mimeType,
    ContentLength: parsed.data.sizeBytes,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: config.s3UploadUrlTtlSeconds });
  res.status(201).json({
    assetId: asset.id,
    uploadUrl,
    expiresIn: config.s3UploadUrlTtlSeconds,
    headers: { "Content-Type": parsed.data.mimeType },
    asset: assetResponse(asset),
  });
}));

mediaAdminRouter.post("/:id/confirm", asyncHandler(async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ message: "Media asset not found." });
  if (asset.uploadedBy !== req.user.email) return res.status(403).json({ message: "This upload belongs to another administrator." });
  if (asset.status === "ready") return res.json({ asset: assetResponse(asset) });

  let head;
  try {
    head = await s3.send(new HeadObjectCommand({ Bucket: config.s3MediaBucket, Key: asset.objectKey }));
  } catch {
    return res.status(400).json({ message: "The upload is not present in S3 yet." });
  }
  if (Number(head.ContentLength) !== Number(asset.sizeBytes) || head.ContentType !== asset.mimeType) {
    return res.status(400).json({ message: "Uploaded file did not match the reserved size and type." });
  }
  const ready = await prisma.mediaAsset.update({ where: { id: asset.id }, data: { status: "ready" } });
  res.json({ asset: { ...assetResponse(ready), url: await signedAssetUrl(ready.objectKey, ready.mimeType) } });
}));

mediaAdminRouter.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const assets = await prisma.mediaAsset.findMany({
    where: { status: "ready" }, orderBy: { createdAt: "desc" }, take: limit,
  });
  const items = await Promise.all(assets.map(async (asset) => ({
    ...assetResponse(asset),
    url: await signedAssetUrl(asset.objectKey, asset.mimeType),
  })));
  res.set("Cache-Control", "no-store");
  res.json({ items });
}));

mediaAdminRouter.get("/:id/download", asyncHandler(async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset || asset.status !== "ready") return res.status(404).json({ message: "Media asset not found." });
  const downloadUrl = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: config.s3MediaBucket, Key: asset.objectKey, ResponseContentDisposition: "inline",
  }), { expiresIn: 300 });
  res.json({ url: downloadUrl });
}));

mediaAdminRouter.delete("/:id", asyncHandler(async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ message: "Media asset not found." });
  const linkedPosts = await prisma.post.count({
    where: {
      OR: [
        { mediaAssetId: asset.id },
        { linkHeaderAssetId: asset.id },
        { audioAssetId: asset.id },
        { videoAssetId: asset.id },
      ],
    },
  });
  if (linkedPosts) return res.status(409).json({ message: "This asset is attached to a post. Remove the reference before deleting it." });
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: config.s3MediaBucket, Key: asset.objectKey }));
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  } catch (error) {
    logger.error({ err: error.message, assetId: asset.id }, "[eye:media] asset delete failed");
    return res.status(502).json({ message: "Could not delete the stored media file." });
  }
  res.json({ ok: true });
}));

export const publicMediaRouter = Router();
publicMediaRouter.get("/:id", asyncHandler(async (req, res) => {
  if (!mediaStorageEnabled) return res.status(503).json({ message: "S3 media storage is not configured." });
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: req.params.id,
      status: "ready",
      OR: [
        { featuredPosts: { some: { status: "published", deletedAt: null } } },
        { linkHeaderPosts: { some: { status: "published", deletedAt: null } } },
        { audioPosts: { some: { status: "published", deletedAt: null } } },
        { videoPosts: { some: { status: "published", deletedAt: null } } },
      ],
    },
    select: { objectKey: true, mimeType: true },
  });
  if (!asset) return res.status(404).json({ message: "Media asset not found." });
  const url = await signedAssetUrl(asset.objectKey, asset.mimeType);
  res.set("Cache-Control", "public, max-age=240, stale-while-revalidate=60");
  res.redirect(302, url);
}));
