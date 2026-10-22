import crypto from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { createNotification, maskEmail } from "./lib/notifications.js";
import { enqueue } from "./lib/queue.js";
import { emailService } from "./lib/email.js";

const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Redis-backed when REDIS_URL is set, otherwise the default memory store.
  store: createRateLimitStore("rl:newsletter:"),
});

const newsletterSchema = z.object({
  email: z.string().email().max(254),
  source: z.string().optional(),
  hp: z.string().optional(),
});

// Double opt-in token: signed with the app secret so it cannot be forged, and
// self-expiring so an old link cannot confirm an address indefinitely. The
// subscriber row already exists; the token only proves mailbox ownership.
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function signConfirmToken(email, issuedAt = Date.now()) {
  const payload = `${email}|${issuedAt}`;
  const signature = crypto.createHmac("sha256", config.jwtSecret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${signature}`;
}

function verifyConfirmToken(token) {
  if (typeof token !== "string") return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", config.jwtSecret).update(payload).digest("base64url");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  const [email, issuedAtRaw] = payload.split("|");
  const issuedAt = Number(issuedAtRaw);
  if (!email || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > CONFIRM_TTL_MS) return null;
  return email;
}

function confirmPage(heading, body) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.5">
  <h1 style="font-size:1.25rem">${heading}</h1>
  <p>${body}</p>
</body></html>`;
}

export const newsletterRouter = Router();

// POST /api/v1/newsletter/subscribe
newsletterRouter.post("/subscribe", subscribeLimiter, async (req, res) => {
  const honeypot = req.body?.hp;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    // Honeypot tripped - act like it worked, don't tip the bot off.
    return res.json({ message: "Check your email - we sent a confirmation link." });
  }

  const parseResult = newsletterSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const email = parseResult.data.email.trim().toLowerCase();
  const source = typeof parseResult.data.source === "string" ? parseResult.data.source.slice(0, 40) : "unknown";

  // A duplicate (P2002) means they are already on the list. Never acknowledge
  // a new signup if the database write failed; otherwise the UI claims data
  // has been saved when it has not.
  let isNewSubscriber = false;
  try {
    await prisma.newsletterSubscriber.create({ data: { email } });
    isNewSubscriber = true;
  } catch (error) {
    if (error.code !== "P2002") {
      console.warn(`[eye:newsletter] could not persist subscriber: ${error.code ?? error.message}`);
      return res.status(503).json({ message: "Signup is temporarily unavailable. Please try again." });
    }
  }

  // Only alert the admin feed for genuinely new signups, not repeat submits.
  if (isNewSubscriber) {
    await createNotification({
      type: "subscriber",
      title: "New newsletter subscriber",
      body: `Signed up from ${source}`,
      actor: maskEmail(email),
    });

    // Queue the double opt-in email. Sending is a no-op that logs when Resend
    // is not configured, so signup still succeeds without a mail provider.
    const apiBaseUrl = config.publicApiUrl || `http://localhost:${config.port}`;
    const token = signConfirmToken(email);
    enqueue("newsletter.confirm", {
      to: email,
      confirmUrl: `${apiBaseUrl}/api/v1/newsletter/confirm?token=${encodeURIComponent(token)}`,
    });
  }

  console.info(`[eye:newsletter] signup accepted (source=${source}, new=${isNewSubscriber})`);
  res.json({
    message: emailService.configured
      ? "Check your email - we sent a confirmation link."
      : "You are on the list. Email confirmation is not available yet.",
  });
});

// GET /api/v1/newsletter/confirm - the landing page for the link in the email.
// Idempotent: confirming an already-confirmed address still reports success.
newsletterRouter.get("/confirm", async (req, res) => {
  const email = verifyConfirmToken(req.query.token);
  if (!email) {
    return res
      .status(400)
      .type("html")
      .send(confirmPage("Link invalid or expired", "Please subscribe again to receive a fresh confirmation link."));
  }

  try {
    await prisma.newsletterSubscriber.updateMany({
      where: { email, confirmed: false },
      data: { confirmed: true },
    });
  } catch (error) {
    console.warn(`[eye:newsletter] could not confirm subscriber: ${error.code ?? error.message}`);
    return res
      .status(503)
      .type("html")
      .send(confirmPage("Something went wrong", "We could not confirm your subscription. Please try the link again."));
  }

  return res
    .type("html")
    .send(confirmPage("Subscription confirmed", "You are on the list. Watch your inbox for new scholarships and updates."));
});