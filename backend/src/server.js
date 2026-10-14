import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config, auditConfig } from "./config.js";
import { authRouter } from "./auth.js";
import { newsletterRouter } from "./newsletter.js";
import { chatRouter } from "./chat.js";
import { adminRouter } from "./admin.js";
import { prisma, disconnectPrisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { cache } from "./lib/cache.js";
import { drain, registerEmailJobs } from "./lib/queue.js";

const app = express();

app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1);

// Attach a request id to every response and log one line per request when it
// finishes. Placed first so it also covers 404s and error responses.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.id = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("x-request-id", requestId);

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      },
      "request",
    );
  });

  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }),
);
// Only small JSON payloads hit these routes - keep the cap tight.
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    // Required for the browser to send and store the session cookie cross-origin.
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Cheap dependency probes - never throw, just report "up"/"down".
async function probeDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "up";
  } catch {
    return "down";
  }
}

app.get("/healthz", async (_req, res) => {
  const [db, cacheHealth] = await Promise.all([probeDatabase(), cache.health()]);
  res.json({ status: "ok", uptime: process.uptime(), db, cache: cacheHealth });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/newsletter", newsletterRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/admin", adminRouter);

app.use((_req, res) => res.status(404).json({ message: "Not found." }));

// Last-resort error handler - never leaks a stack trace in production.
app.use((error, _req, res, _next) => {
  logger.error({ err: error.message }, "[eye:error]");
  res.status(error.status ?? 500).json({
    message: config.isProduction ? "Something went wrong." : error.message,
  });
});

// Bad auth config is fatal in production, but in development we keep serving so
// the owner can fix the environment without the process refusing to boot.
const problems = auditConfig();
if (problems.length > 0) {
  const banner = `[eye:config] ${problems.join("; ")}`;
  if (config.isProduction) {
    logger.error(`${banner} - refusing to start in production.`);
    process.exit(1);
  }
  logger.warn(`${banner} - sign-in will be unavailable until fixed.`);
}

// Register the placeholder email handlers before any request can enqueue work.
registerEmailJobs();

const server = app.listen(config.port, () => {
  const mode = config.isProduction ? "production" : "development";
  logger.info(`[eye:api] listening on http://localhost:${config.port} (${mode})`);

  // Non-blocking connectivity probe - the API keeps serving if Postgres is
  // down, we just surface a warning so the operator knows why writes fail.
  prisma
    .$queryRaw`SELECT 1`
    .then(() => logger.info("[eye:db] database connection OK"))
    .catch((error) =>
      logger.warn(`[eye:db] database unreachable: ${error.code ?? error.message}`),
    );
});

let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "[eye:api] shutting down");

  // Stop accepting new connections, but do not wait forever for keep-alives.
  const serverClosed = new Promise((resolve) => {
    server.close((error) => {
      if (error) logger.error({ err: error.message }, "[eye:api] server close failed");
      resolve();
    });
    setTimeout(resolve, 10000).unref();
  });

  try {
    await Promise.all([serverClosed, drain(5000)]);
    await disconnectPrisma(signal);
    await cache.close();
  } catch (error) {
    logger.error({ err: error.message }, "[eye:api] shutdown error");
  } finally {
    process.exit(exitCode);
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
