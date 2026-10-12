import { Router } from "express";
import rateLimit from "express-rate-limit";

const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// Deliberately loose: this only rejects obvious garbage. Real ownership is
// proven later by the double opt-in confirmation email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const newsletterRouter = Router();

// POST /api/v1/newsletter/subscribe
newsletterRouter.post("/subscribe", subscribeLimiter, (req, res) => {
  const honeypot = req.body?.hp;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    // Honeypot tripped: pretend success so bots get no signal.
    return res.json({ message: "You are on the list. Check your inbox for a confirmation." });
  }

  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const source = typeof req.body?.source === "string" ? req.body.source.slice(0, 40) : "unknown";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  // TODO: persist the subscriber (store consent timestamp + IP) and send a
  // double opt-in confirmation email once a mail provider is wired up.
  console.info(`[eye:newsletter] signup accepted (source=${source})`);
  res.json({ message: "Check your email - we sent a confirmation link." });
});
