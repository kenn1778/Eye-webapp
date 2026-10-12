import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";

export const SESSION_COOKIE = "eye.sid";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many reset requests. Please try again later." },
});

// Shared cookie attributes. maxAge is only added when we set the cookie; when
// clearing it we must reuse the same attributes but leave off the expiry.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
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
function issueToken(email) {
  return jwt.sign({ sub: email, role: "admin" }, config.jwtSecret, {
    expiresIn: `${config.sessionTtlHours}h`,
    issuer: "eye-api",
  });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ message: "Not signed in." });
  try {
    const payload = jwt.verify(token, config.jwtSecret, { issuer: "eye-api" });
    req.user = { email: payload.sub, role: payload.role };
    return next();
  } catch {
    res.clearCookie(SESSION_COOKIE, baseCookieOptions());
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post("/login", loginLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!config.adminPasswordHash || !config.adminEmail) {
    return res.status(503).json({ message: "Sign-in is not configured on this server." });
  }
  if (!email || !password) {
    return res.status(400).json({ message: "Enter your email and password." });
  }

  const emailMatches = email === config.adminEmail;
  const passwordMatches = await bcrypt.compare(password, config.adminPasswordHash);
  // One generic message so a wrong email and a wrong password are indistinguishable.
  if (!emailMatches || !passwordMatches) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.cookie(SESSION_COOKIE, issueToken(email), cookieOptions());
  return res.json({ user: { email } });
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
