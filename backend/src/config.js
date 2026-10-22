import "dotenv/config";

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  // Junk values fall through to false instead of throwing - a typo just
  // means "off", it doesn't crash startup.
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

export const config = {
  nodeEnv,
  isProduction,
  port: toInt(process.env.PORT, 4000),
  // pino level. Quieter by default in production, chattier in development.
  logLevel: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  // Optional Redis connection. Empty means "use the in-memory fallbacks".
  redisUrl: process.env.REDIS_URL ?? "",
  // Trimmed and lowercased here to match how login treats the input.
  adminEmail: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  jwtSecret: process.env.AUTH_JWT_SECRET ?? "",
  corsOrigins: (() => {
    const origins = (process.env.CORS_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    
    if (isProduction && origins.length === 0) {
      // Will be caught by auditConfig
      return [];
    }
    return origins.length > 0 ? origins : ["http://localhost:5173", "http://127.0.0.1:5173"];
  })(),
  sessionTtlHours: toInt(process.env.SESSION_TTL_HOURS, 8),
  trustProxy: toBool(process.env.TRUST_PROXY, false),
  cookieSecure: toBool(process.env.COOKIE_SECURE, isProduction),
  // Postgres connection string used by Prisma (see prisma.config.ts).
  databaseUrl: process.env.DATABASE_URL ?? "",
  awsRegion: process.env.AWS_REGION ?? "",
  s3MediaBucket: process.env.S3_MEDIA_BUCKET ?? "",
  s3MediaPublicBaseUrl: (process.env.S3_MEDIA_PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
  s3BackupBucket: process.env.S3_BACKUP_BUCKET ?? "",
  s3BackupPrefix: (process.env.S3_BACKUP_PREFIX ?? "postgres").replace(/^\/+|\/+$/g, ""),
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3ForcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, false),
  s3UploadUrlTtlSeconds: toInt(process.env.S3_UPLOAD_URL_TTL_SECONDS, 600),
  // Resend transactional email. An empty API key disables delivery; queued
  // emails are then logged instead of sent, so development needs no account.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  // Verified sender identity, e.g. "EYE Scholarships <hello@example.com>".
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailReplyTo: process.env.EMAIL_REPLY_TO ?? "",
  emailTimeoutMs: toInt(process.env.EMAIL_TIMEOUT_MS, 10000),
  // Public base URL of this API, used to build links inside emails. Empty
  // falls back to localhost on the configured port.
  publicApiUrl: (process.env.PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  // Public base URL of the web app, used to build the reset link that goes in
  // emails. Empty falls back to the first CORS origin (the dev server).
  appBaseUrl: (process.env.APP_BASE_URL ?? "").replace(/\/$/, ""),
  // Google Gemini powers the community chat assistant. Empty key disables the
  // assistant (the chat falls back to its built-in replies).
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // "gemini-flash-latest" tracks the current stable Flash model, so the
  // assistant keeps working when Google retires a dated model.
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  geminiTimeoutMs: toInt(process.env.GEMINI_TIMEOUT_MS, 12000),
  // Paystack powers premium membership. An empty secret key disables checkout
  // (the plans endpoint still responds, with enabled: false).
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
  membershipCurrency: process.env.MEMBERSHIP_CURRENCY ?? "NGN",
  // Where Paystack sends the browser back after payment.
  membershipCallbackUrl: process.env.MEMBERSHIP_CALLBACK_URL ?? "",
  // Single monthly plan for now. Price is in the smallest unit (kobo for NGN).
  membershipPlans: [
    {
      id: "premium-monthly",
      name: "Premium",
      interval: "monthly",
      amountKobo: toInt(process.env.MEMBERSHIP_PRICE_KOBO, 250000),
    },
  ],
};

export function auditConfig() {
  const problems = [];
  if (!config.adminEmail) problems.push("ADMIN_EMAIL is not set");
  if (!config.adminPasswordHash) problems.push("ADMIN_PASSWORD_HASH is not set (run `npm run hash-password`)");
  // Enforce in ALL environments, not just production
  if (config.jwtSecret.length < 32) problems.push("AUTH_JWT_SECRET must be at least 32 characters");
  // Require admin password hash in production
  if (config.isProduction && !config.adminPasswordHash) {
    problems.push("ADMIN_PASSWORD_HASH is required in production");
  }
  // Validate Paystack key format if provided
  if (config.paystackSecretKey && !config.paystackSecretKey.startsWith("sk_")) {
    problems.push("PAYSTACK_SECRET_KEY appears invalid (should start with sk_)");
  }
  // Validate Gemini key format if provided
  if (config.geminiApiKey && config.geminiApiKey.length < 20) {
    problems.push("GEMINI_API_KEY appears invalid (too short)");
  }
  // Validate S3 config consistency
  if (config.awsRegion && !config.s3MediaBucket) {
    problems.push("AWS_REGION set but S3_MEDIA_BUCKET missing");
  }
  if (config.s3MediaBucket && !config.awsRegion) {
    problems.push("S3_MEDIA_BUCKET set but AWS_REGION missing");
  }
  // Email needs both a provider key and a verified sender to deliver.
  if (config.resendApiKey && !config.emailFrom) {
    problems.push("RESEND_API_KEY set but EMAIL_FROM missing");
  }
  if (config.emailFrom && !config.resendApiKey) {
    problems.push("EMAIL_FROM set but RESEND_API_KEY missing");
  }
  // Password-reset links are built from APP_BASE_URL, falling back to the first
  // CORS origin. With neither set the link would be relative and unusable.
  if (config.resendApiKey && !config.appBaseUrl && config.corsOrigins.length === 0) {
    problems.push("APP_BASE_URL (or CORS_ORIGIN) is required to build password-reset links");
  }
  // CORS must be explicitly configured in production
  if (config.isProduction && config.corsOrigins.length === 0) {
    problems.push("CORS_ORIGIN must be set in production");
  }
  return problems;
}
