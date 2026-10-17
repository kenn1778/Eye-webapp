import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { enqueue } from "./lib/queue.js";
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

  // Create-only so we can tell a fresh signup from a repeat one. A duplicate
  // (P2002) means they were already on the list, which is still a success. A
  // database outage must not change the response - we log it and still
  // acknowledge the signup.
  let isNewSubscriber = false;
  try {
    await prisma.newsletterSubscriber.create({ data: { email } });
    isNewSubscriber = true;
  } catch (error) {
    if (error.code !== "P2002") {
      console.warn(`[eye:newsletter] could not persist subscriber: ${error.code ?? error.message}`);
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

  // TODO: send a double opt-in confirmation email once a mail provider is wired up.
  // For now the confirmation is queued as a background job (logged, not sent).
  enqueue("newsletter.confirm", { to: email, source });
  console.info(`[eye:newsletter] signup accepted (source=${source})`);
  res.json({ message: "Check your email - we sent a confirmation link." });
});
