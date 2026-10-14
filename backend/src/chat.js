import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { createNotification } from "./lib/notifications.js";
import { generateReply } from "./lib/gemini.js";
import { logger } from "./lib/logger.js";

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You are sending messages too quickly. Please slow down." },
  store: createRateLimitStore("rl:chat:"),
});

// The assistant calls a paid upstream, so it gets its own tighter per-IP cap.
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "The assistant is busy. Please try again in a moment." },
  store: createRateLimitStore("rl:agent:"),
});

const messageSchema = z.object({
  community: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(500),
  hp: z.string().optional(),
});

const agentSchema = z.object({
  community: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(500),
});

export const chatRouter = Router();

// POST /api/v1/chat/messages
// Persists a community message and raises an admin notification. The public
// chat UI is a demo, so this is best-effort: the client never blocks on it.
chatRouter.post("/messages", chatLimiter, async (req, res) => {
  const honeypot = req.body?.hp;
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    // Honeypot tripped - pretend it worked so the bot learns nothing.
    return res.json({ ok: true });
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter a message between 1 and 500 characters." });
  }

  const { community: communityName, text } = parsed.data;

  try {
    const community = await prisma.community.upsert({
      where: { name: communityName },
      update: {},
      create: { name: communityName },
    });

    await prisma.chatMessage.create({
      data: { content: text, communityId: community.id },
    });

    await createNotification({
      type: "chat",
      title: `New message in ${communityName}`,
      body: text.length > 140 ? `${text.slice(0, 140)}...` : text,
      actor: "A visitor",
    });
  } catch (error) {
    // A database outage must not break the visitor's chat experience.
    logger.warn({ err: error.code ?? error.message }, "[eye:chat] could not persist message");
  }

  res.json({ ok: true });
});

// POST /api/v1/chat/agent
// Returns a professional reply from the EYE Assistant. The visitor's message is
// persisted separately via /messages, so this endpoint only generates text.
// When the assistant is unconfigured or the upstream fails we answer 503 and the
// client falls back to its built-in replies.
chatRouter.post("/agent", agentLimiter, async (req, res) => {
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Enter a message between 1 and 500 characters." });
  }

  const { community, text } = parsed.data;
  const reply = await generateReply({ community, text });

  if (!reply) {
    return res.status(503).json({ message: "The assistant is unavailable right now." });
  }

  res.json({ reply });
});
