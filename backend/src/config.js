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
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
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
  if (config.jwtSecret.length < 32) problems.push("AUTH_JWT_SECRET must be at least 32 characters");
  return problems;
}
