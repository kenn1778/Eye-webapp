import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { createNotification, maskEmail } from "./lib/notifications.js";
import { logger } from "./lib/logger.js";
import {
  paymentsEnabled,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} from "./lib/payments.js";

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many checkout attempts. Please try again later." },
  store: createRateLimitStore("rl:membership:"),
});

const checkoutSchema = z.object({
  email: z.string().email().max(254),
  plan: z.string().max(60).optional(),
});

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export const membershipRouter = Router();

// GET /api/v1/membership/plans - public plan catalogue.
membershipRouter.get("/plans", (_req, res) => {
  res.json({
    enabled: paymentsEnabled,
    currency: config.membershipCurrency,
    plans: config.membershipPlans,
  });
});

// POST /api/v1/membership/checkout - start a Paystack transaction.
membershipRouter.post("/checkout", checkoutLimiter, async (req, res) => {
  if (!paymentsEnabled) {
    return res.status(503).json({ message: "Membership is not available yet." });
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const planId = parsed.data.plan ?? config.membershipPlans[0]?.id;
  const plan = config.membershipPlans.find((item) => item.id === planId);
  if (!plan) return res.status(400).json({ message: "Unknown plan." });

  const reference = `eye_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const transaction = await initializeTransaction({
      email,
      amountKobo: plan.amountKobo,
      reference,
      callbackUrl: config.membershipCallbackUrl,
      metadata: { plan: plan.id },
    });

    // Record intent so the webhook/verify step can find the row by email.
    await prisma.subscription.upsert({
      where: { email },
      create: { email, plan: plan.id, status: "pending", providerRef: reference },
      update: { plan: plan.id, status: "pending", providerRef: reference },
    });

    res.json({ authorizationUrl: transaction.authorization_url, reference: transaction.reference });
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:membership] checkout failed");
    res.status(502).json({ message: "Could not start checkout. Please try again." });
  }
});

// GET /api/v1/membership/verify?reference=... - confirm a payment after redirect.
membershipRouter.get("/verify", async (req, res) => {
  if (!paymentsEnabled) {
    return res.status(503).json({ message: "Membership is not available yet." });
  }

  const reference = String(req.query.reference ?? "");
  if (!reference) return res.status(400).json({ message: "Missing reference." });

  try {
    const transaction = await verifyTransaction(reference);
    const active = transaction.status === "success";
    if (active) await activateSubscription(transaction);
    res.json({
      status: transaction.status,
      active,
      plan: transaction.metadata?.plan ?? "premium",
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:membership] verify failed");
    res.status(502).json({ message: "Could not verify payment." });
  }
});

// POST /api/v1/membership/webhook - Paystack server-to-server notification.
// The raw body is captured in server.js so the signature can be verified.
membershipRouter.post("/webhook", async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ message: "Invalid signature." });
  }

  const event = req.body;
  if (event?.event === "charge.success") {
    await activateSubscription(event.data);
  }
  res.json({ received: true });
});

// Flip a subscription to active and alert the admin feed. Idempotent: Paystack
// may deliver the same event more than once.
async function activateSubscription(transaction) {
  const email = (transaction?.customer?.email ?? "").trim().toLowerCase();
  if (!email) return;

  const plan = transaction?.metadata?.plan ?? "premium";
  const currentPeriodEnd = new Date(Date.now() + PERIOD_MS);

  try {
    await prisma.subscription.upsert({
      where: { email },
      create: {
        email,
        plan,
        status: "active",
        providerRef: transaction.reference,
        currentPeriodEnd,
      },
      update: {
        plan,
        status: "active",
        providerRef: transaction.reference,
        currentPeriodEnd,
      },
    });

    await createNotification({
      type: "system",
      title: "New premium member",
      body: `Plan: ${plan}`,
      actor: maskEmail(email),
    });
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:membership] activation failed");
  }
}
