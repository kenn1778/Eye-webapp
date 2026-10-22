import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { enqueue } from "./lib/queue.js";
import { createRateLimitStore } from "./lib/rate-limit.js";

export const SESSION_COOKIE = config.isProduction || config.cookieSecure ? "__Host-session" : "eye-session";

// Shared by sign-in and password reset, so a new password always satisfies the
// same complexity rules it will be checked against on the way back in.
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16).max(512),
  password: passwordSchema,
});

// Reset links are short-lived: long enough for a mail round trip, short enough
// that a leaked inbox is unlikely to still hold a usable link.
const RESET_TTL_MS = 30 * 60 * 1000;

// The token travels by email in the clear and is stored only as a hash, so a
// database dump cannot be replayed against /reset-password.
function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Links point at the web app, not this API. APP_BASE_URL wins; otherwise the
// first configured CORS origin (the dev server) is used.
function resetUrlFor(token) {
  const base = config.appBaseUrl || config.corsOrigins[0] || "";
  const path = "/reset-password?token=" + encodeURIComponent(token);
  return base ? base + path : path;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
  // Redis-backed when REDIS_URL is set, otherwise the default memory store.
  store: createRateLimitStore("rl:login:"),
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many reset requests. Please try again later." },
  store: createRateLimitStore("rl:reset:"),
});

// Submitting a new password is a distinct step from requesting the link, so it
// gets its own bucket instead of sharing the tighter request allowance.
const resetSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many reset attempts. Please try again later." },
  store: createRateLimitStore("rl:reset-submit:"),
});

// Shared cookie attributes. maxAge is only added when we set the cookie; when
// clearing it we must reuse the same attributes but leave off the expiry.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction ? true : config.cookieSecure,
    sameSite: config.isProduction ? "strict" : "lax",
    path: "/",
  };
}

function cookieOptions() {
  return {
    ...baseCookieOptions(),
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  };
}

// Single-admin deployment, so every verified sign-in carries the admin role.
function issueToken(email, id = null) {
  return jwt.sign({ sub: email, uid: id, role: "admin" }, config.jwtSecret, {
    expiresIn: `${config.sessionTtlHours}h`,
    issuer: "eye-api",
  });
}

// Look up a database-backed user, tolerating an unreachable database so the
// configured admin account can still sign in.
async function findUserByEmail(email) {
  try {
    return await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.warn(`[eye:auth] user lookup failed: ${error.code ?? error.message}`);
    return null;
  }
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ message: "Not signed in." });
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: "eye-api" });
    req.user = { id: payload.uid ?? null, email: payload.sub, role: payload.role };
    return next();
  } catch {
    res.clearCookie(SESSION_COOKIE, baseCookieOptions());
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}

export function refreshSessionCookie(res, user) {
  res.cookie(SESSION_COOKIE, issueToken(user.email, user.id), cookieOptions());
}

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post("/login", loginLimiter, async (req, res) => {
  if (!config.databaseUrl && (!config.adminPasswordHash || !config.adminEmail)) {
    return res.status(503).json({ message: "Sign-in is not configured on this server." });
  }

  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Enter a valid email and password (min 8 characters)." });
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Prefer a database user; fall back to the single admin from the environment
  // so existing deployments keep working before any users are seeded.
  const [user, profile] = await Promise.all([
    findUserByEmail(normalizedEmail),
    prisma.adminProfile.findUnique({ where: { email: normalizedEmail } }).catch(() => null),
  ]);
  const passwordHash =
    profile?.passwordHash ??
    user?.passwordHash ??
    (normalizedEmail === config.adminEmail ? config.adminPasswordHash : "");
  const passwordMatches = passwordHash ? await bcrypt.compare(password, passwordHash) : false;
  // Same message either way so attackers can't tell which field was wrong.
  if (!passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const profileId = profile?.id ?? user?.id ?? null;
  res.cookie(SESSION_COOKIE, issueToken(normalizedEmail, profileId), cookieOptions());
  return res.json({ user: { email: normalizedEmail, name: profile?.name ?? user?.name ?? null } });
});

// GET /api/v1/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: { email: req.user.email } });
});

// POST /api/v1/auth/logout
authRouter.post("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions());
  res.json({ ok: true });
});

// POST /api/v1/auth/forgot-password
authRouter.post("/forgot-password", resetLimiter, async (req, res) => {
  // Always answer the same way, and never report why nothing was sent, so the
  // endpoint cannot be used to enumerate accounts.
  const generic = { message: "If that address is registered, a reset link has been sent." };
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.json(generic);

  const email = parsed.data.email.trim().toLowerCase();
  try {
    // Either account kind can be reset; the environment admin may have no row.
    const [user, profile] = await Promise.all([
      findUserByEmail(email),
      prisma.adminProfile.findUnique({ where: { email } }).catch(() => null),
    ]);

    if (user || profile || email === config.adminEmail) {
      const token = crypto.randomBytes(32).toString("base64url");
      const now = new Date();
      await prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(now.getTime() + RESET_TTL_MS),
        },
      });
      // Drop this address's spent links so the table does not grow forever.
      await prisma.passwordResetToken.deleteMany({
        where: { email, OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
      });
      enqueue("password.reset", {
        to: email,
        resetUrl: resetUrlFor(token),
        expiresInMinutes: Math.round(RESET_TTL_MS / 60000),
      });
    }
  } catch (error) {
    // A mail or database hiccup must not change the response shape.
    console.warn(`[eye:auth] password reset request failed: ${error.code ?? error.message}`);
  }

  return res.json(generic);
});

// POST /api/v1/auth/reset-password
authRouter.post("/reset-password", resetSubmitLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? "Enter a reset link and a new password.",
    });
  }

  const { token, password } = parsed.data;
  const now = new Date();

  let record;
  try {
    record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  } catch (error) {
    console.warn(`[eye:auth] password reset lookup failed: ${error.code ?? error.message}`);
    return res.status(503).json({ message: "Password reset is temporarily unavailable. Please try again." });
  }

  // One message for unknown, expired, and already-used tokens.
  const invalid = { message: "This reset link is invalid or has expired. Request a new one." };
  if (!record || record.usedAt || record.expiresAt <= now) {
    return res.status(400).json(invalid);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const users = await tx.user.updateMany({ where: { email: record.email }, data: { passwordHash } });
      const profiles = await tx.adminProfile.updateMany({ where: { email: record.email }, data: { passwordHash } });
      if (users.count === 0 && profiles.count === 0) return false;
      await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } });
      // Any other outstanding link for this address is now stale.
      await tx.passwordResetToken.deleteMany({ where: { email: record.email, id: { not: record.id } } });
      return true;
    });
    if (!updated) return res.status(400).json(invalid);
  } catch (error) {
    console.warn(`[eye:auth] password reset failed: ${error.code ?? error.message}`);
    return res.status(503).json({ message: "Password reset is temporarily unavailable. Please try again." });
  }

  // Drop the current browser session, if any, so the user signs in fresh.
  res.clearCookie(SESSION_COOKIE, baseCookieOptions());
  return res.json({ message: "Password updated. You can sign in now." });
});