import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { prisma } from "./lib/prisma.js";
import { publicMediaPath } from "./lib/s3.js";
import { config } from "./config.js";

// Story link previews (Open Graph infurls). When a /story/:id link is pasted
// into WhatsApp, X, Facebook, etc., their crawlers fetch the URL but do not run
// JavaScript, so the static index.html would preview as a generic homepage.
// This route serves the SAME SPA page with per-story <head> tags injected.
// Browsers get an identical app; crawlers get a complete article card.
export const storyMetaRouter = Router();

// Same reasoning as public.js: Express 4 does not forward rejected promises,
// so an async route must forward a database outage to the error middleware.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const SITE_NAME = "Xplore";
const SITE_URL = (config.appBaseUrl || config.corsOrigins[0] || "").replace(/\/$/, "");
const TAGLINE = "Scholarships, work, ideas, and culture for students and early-career builders.";
const SITE_TITLE = `${SITE_NAME} | Share ideas, Inspire Minds`;
const DEFAULT_DESCRIPTION = `${SITE_NAME} — ${TAGLINE}`;
const FALLBACK_IMAGE = `${SITE_URL}/xplore-badge.png`;

// The SPA shell the frontend deploy uploads to /opt/eye/backend/view/. Read on
// demand with a mtime cache so a redeploy is picked up without a restart.
const INDEX_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../view/index.html",
);
let shellCache = null;
let shellMtimeMs = 0;
function loadShell() {
  try {
    const stats = fs.statSync(INDEX_PATH);
    if (!shellCache || stats.mtimeMs !== shellMtimeMs) {
      shellCache = fs.readFileSync(INDEX_PATH, "utf8");
      shellMtimeMs = stats.mtimeMs;
    }
    return shellCache;
  } catch {
    return null;
  }
}

// Attribute contexts only allow text through after entity escaping.
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// JSON inside <script> must not contain "</" (or HTML comments).
const escapeJsonLd = (value) =>
  JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e");

// Content is stored as rich text; crawlers want plain prose.
const toText = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const toAbsoluteUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith("/") ? `${SITE_URL}${value}` : null;
};

const descriptionFor = (post) => {
  const text = toText(post.excerpt).slice(0, 200);
  if (text) return text;
  return toText(post.content).slice(0, 200) || DEFAULT_DESCRIPTION;
};

// Mirrors shapePost() in public.js: media assets are S3-backed and referenced
// by asset id; a legacy image field is a direct URL.
const imageUrlFor = (post) =>
  toAbsoluteUrl(post.mediaAssetId ? publicMediaPath(post.mediaAssetId) : post.image) ??
  toAbsoluteUrl(post.linkHeaderAssetId ? publicMediaPath(post.linkHeaderAssetId) : post.linkHeaderUrl) ??
  FALLBACK_IMAGE;

// The SPA shell already carries site-wide defaults; every one of them is
// replaced here so exactly one value per property reaches the crawler.
const STATIC_TAGS =
  /<meta\s+(?:name|property)=["'](?:description|og:title|og:description|og:url|og:image|og:image:alt|og:type|og:site_name|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*\/?>|<link\s+rel=["']canonical["'][^>]*\/?>|<title>[\s\S]*?<\/title>|<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi;

const publishedPostSelect = {
  id: true,
  title: true,
  content: true,
  excerpt: true,
  image: true,
  linkHeaderAssetId: true,
  linkHeaderUrl: true,
  mediaAssetId: true,
  publishedAt: true,
  createdAt: true,
};

// Helmet's CSP (set for JSON APIs) is stricter than the SPA's inline-script
// policy; the shell's own meta CSP is what the app expects, so override it.
const SHELL_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function metaTags({ title, description, image, url, type, jsonLd }) {
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    type === "article"
      ? `<meta property="og:type" content="article" />`
      : `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");
}

function noticePage(title, message, status) {
  const body = loadShell();
  if (!body) {
    // No SPA shell available: still return a valid preview card plus a plain
    // link (never an automatic redirect - the same path serves the app too).
    return {
      status,
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><meta property="og:site_name" content="${SITE_NAME}" /><meta property="og:title" content="${escapeHtml(title)}" /><meta property="og:image" content="${escapeHtml(FALLBACK_IMAGE)}" /><meta name="twitter:card" content="summary_large_image" /></head><body><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_NAME)}</a></p></body></html>`,
    };
  }
  // Rebrand the shell's head for the notice and keep the browser on the site.
  const tags = metaTags({
    title,
    description: DEFAULT_DESCRIPTION,
    image: FALLBACK_IMAGE,
    url: SITE_URL,
    type: "website",
    jsonLd: escapeJsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    }),
  });
  return { status, html: body.replace(STATIC_TAGS, "").replace(/<head>/i, `<head>\n    ${tags}`) };
}

storyMetaRouter.get("/story/:id", asyncHandler(async (req, res) => {
  const shell = loadShell();
  const post = await prisma.post.findUnique({
    // Same visibility rules as every other public read endpoint.
    where: { id: req.params.id, status: "published", deletedAt: null },
    select: publishedPostSelect,
  });

  if (!post) {
    const { status, html } = noticePage(SITE_TITLE, "This story is not available.", 404);
    return res.status(status).set("Content-Security-Policy", SHELL_CSP).type("html").send(html);
  }

  const url = `${SITE_URL}/story/${post.id}`;
  const description = descriptionFor(post);
  const image = imageUrlFor(post);

  if (!shell) {
    // Cheap but complete card: preview platforms still get a correct unfurl
    // even before the SPA shell has been uploaded after a fresh backend deploy.
    const jsonLd = escapeJsonLd({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      image: [image],
      datePublished: post.publishedAt ?? post.createdAt,
      url,
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    });
    return res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8" />${metaTags({
          title: post.title,
          description,
          image,
          url,
          type: "article",
          jsonLd,
        })}</head><body><p>${escapeHtml(post.title)}</p><p><a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_NAME)}</a></p></body></html>`,
      );
  }

  const jsonLd = escapeJsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description,
    image: [image],
    datePublished: post.publishedAt ?? post.createdAt,
    url,
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  });

  const tags = metaTags({ title: post.title, description, image, url, type: "article", jsonLd });
  const html = shell.replace(STATIC_TAGS, "").replace(/<head>/i, `<head>\n    ${tags}`);

  // Short shared-cache TTL: previews unfurl quickly, edits propagate within 5
  // minutes, yet CloudFront absorbs repeat crawler hits.
  res
    .status(200)
    .set("Content-Security-Policy", SHELL_CSP)
    .set("Cache-Control", "public, max-age=0, s-maxage=60")
    .type("html")
    .send(html);
}));
