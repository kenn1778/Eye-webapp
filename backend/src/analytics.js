import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireAdmin } from "./auth.js";
import { cache } from "./lib/cache.js";
import { createRateLimitStore } from "./lib/rate-limit.js";
import { fetchGaTraffic, ga4Enabled } from "./lib/ga4.js";

// Admin-only readback of GA4 site traffic for the dashboard. Queries the
// upstream Data API on a cache cadence (10 minutes), so a dozen admins
// refreshing never translate into a dozen Google API calls (quotas exist).
const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many analytics requests. Please slow down." },
  store: createRateLimitStore("rl:analytics:"),
});

const CACHE_KEY = "admin:ga4";
const CACHE_TTL_SECONDS = 600;

const windowSchema = z.coerce.number().int().min(7).max(28).default(28);

export const analyticsRouter = Router();

analyticsRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  analyticsLimiter,
  async (req, res, next) => {
    const days = windowSchema.safeParse(req.query.days);
    if (!days.success) return res.status(400).json({ message: "Invalid window." });

    // Disabled deployments must answer 200 with { enabled: false } so the
    // dashboard can hide the card instead of erroring.
    if (!ga4Enabled()) return res.json({ enabled: false });

    const cached = await cache.get(`${CACHE_KEY}:${days.data}`);
    if (cached) return res.json(cached);

    try {
      const payload = await fetchGaTraffic({ days: days.data });
      await cache.set(`${CACHE_KEY}:${days.data}`, payload, CACHE_TTL_SECONDS);
      return res.json(payload);
    } catch (error) {
      if (String(error?.message ?? "").startsWith("GA4_")) {
        // Configuration/read errors are surfaced as a disabled-signal, not a
        // server error: the dashboard degrades gracefully.
        return res.json({ enabled: false, reason: error.message });
      }
      return next(error);
    }
  },
);
