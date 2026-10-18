import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { createRateLimitStore } from "./lib/rate-limit.js";

export const SESSION_COOKIE = config.isProduction || config.cookieSecure ? "__Host-session" : "eye-session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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

// Shared cookie attributes. maxAge is only added when we set the cookie; when
// clearing it we must reuse the same attributes but leave off the expiry.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction ? true : config.cookieSecure,
    sameSite: "lax",
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
authRouter.post("/forgot-password", resetLimiter, (req, res) => {
  // Always answer the same way so attackers cannot enumerate accounts.
  // In production: generate a single-use token (30 minute expiry, stored
  // hashed) and email it. No mail transport is configured here yet.
  console.info("[eye:auth] password reset requested");
  res.json({ message: "If that address is registered, a reset link has been sent." });
});
