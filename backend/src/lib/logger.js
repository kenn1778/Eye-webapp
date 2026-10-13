import { createRequire } from "node:module";
import pino from "pino";
import { config } from "../config.js";

const require = createRequire(import.meta.url);

// Production emits newline-delimited JSON for log shippers. In development we
// prefer pino-pretty, but that is a dev-only dependency - if it is missing we
// silently fall back to JSON instead of crashing at boot.
function buildTransport() {
  if (config.isProduction) return undefined;
  try {
    require.resolve("pino-pretty");
  } catch {
    return undefined;
  }
  return {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

export const logger = pino({
  level: config.logLevel,
  base: { service: "eye-api" },
  transport: buildTransport(),
});
