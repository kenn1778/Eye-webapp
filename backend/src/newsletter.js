import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { createNotification, maskEmail } from "./lib/notifications.js";

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
  }

  // Mail delivery is not configured; be explicit rather than promising an
  // email that will never arrive. Subscribers are persisted as unconfirmed.
  console.info(`[eye:newsletter] signup accepted (source=${source})`);
  res.json({ message: "You are on the list. Email confirmation is not available yet." });
});
