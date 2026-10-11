import "dotenv/config";

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isProduction = (process.env.NODE_ENV ?? "development") === "production";

export const config = {
  isProduction,
  port: toInt(process.env.PORT, 4000),
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
};

/** Returns a list of configuration problems that must be fixed before launch. */
export function auditConfig() {
  const problems = [];
  if (!config.adminEmail) problems.push("ADMIN_EMAIL is not set");
  if (!config.adminPasswordHash) problems.push("ADMIN_PASSWORD_HASH is not set (run `npm run hash-password`)");
  if (config.jwtSecret.length < 32) problems.push("AUTH_JWT_SECRET must be at least 32 characters");
  return problems;
}
