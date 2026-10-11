import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config, auditConfig } from "./config.js";
import { authRouter } from "./auth.js";
import { newsletterRouter } from "./newsletter.js";

const app = express();

app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/newsletter", newsletterRouter);

app.use((_req, res) => res.status(404).json({ message: "Not found." }));

// Central error handler. Never leaks a stack trace in production.
app.use((error, _req, res, _next) => {
  console.error("[eye:error]", error.message);
  res.status(error.status ?? 500).json({
    message: config.isProduction ? "Something went wrong." : error.message,
  });
});

const problems = auditConfig();
if (problems.length > 0) {
  const banner = `[eye:config] ${problems.join("; ")}`;
  if (config.isProduction) {
    console.error(`${banner} - refusing to start in production.`);
    process.exit(1);
  }
  console.warn(`${banner} - sign-in will be unavailable until fixed.`);
}

app.listen(config.port, () => {
  const mode = config.isProduction ? "production" : "development";
  console.info(`[eye:api] listening on http://localhost:${config.port} (${mode})`);
});
