import Redis from "ioredis";
import { config } from "../config.js";
import { logger } from "./logger.js";

let warned = false;

// Only ever log the "we lost Redis" warning once per process so a flapping
// connection does not flood the logs.
function warnOnce(message) {
  if (warned) return;
  warned = true;
  logger.warn(`[eye:cache] ${message}`);
}

// Minimal TTL map used when Redis is not configured or not reachable. Expiry is
// checked lazily on read, which is plenty for the small API caches here.
class MemoryCache {
  #entries = new Map();

  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    const expiresAt =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.#entries.set(key, { value, expiresAt });
  }

  del(key) {
    this.#entries.delete(key);
  }
}

const memory = new MemoryCache();

let redis = null;
let redisReady = false;

if (config.redisUrl) {
  try {
    redis = new Redis(config.redisUrl, {
      // Fail fast instead of queueing commands while disconnected; callers fall
      // back to memory until the "ready" event fires.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redis.on("ready", () => {
      redisReady = true;
    });
    redis.on("error", (error) => {
      redisReady = false;
      warnOnce(`redis unavailable, falling back to memory: ${error.message}`);
    });
  } catch (error) {
    redis = null;
    warnOnce(`could not initialise redis, using memory: ${error.message}`);
  }
}

async function withRedis(operation, fallback) {
  if (redis && redisReady) {
    try {
      return await operation();
    } catch (error) {
      redisReady = false;
      warnOnce(`redis unavailable, using memory: ${error.message ?? error}`);
    }
  }
  return fallback();
}

export const cache = {
  async get(key) {
    return withRedis(async () => {
      const raw = await redis.get(key);
      return raw == null ? null : JSON.parse(raw);
    }, () => memory.get(key) ?? null);
  },

  async set(key, value, ttlSeconds) {
    const serialized = JSON.stringify(value);
    return withRedis(
      async () => {
        if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
          await redis.set(key, serialized, "EX", Math.floor(ttlSeconds));
        } else {
          await redis.set(key, serialized);
        }
        return true;
      },
      () => {
        memory.set(key, value, ttlSeconds);
        return true;
      },
    );
  },

  async del(key) {
    return withRedis(
      async () => {
        await redis.del(key);
        return true;
      },
      () => {
        memory.del(key);
        return true;
      },
    );
  },

  // Cheap liveness probe. Reports the Redis backend when configured, otherwise
  // the in-memory store which is always available.
  async health() {
    if (!redis || !config.redisUrl) return "up";
    try {
      await redis.ping();
      redisReady = true;
      return "up";
    } catch {
      redisReady = false;
      return "down";
    }
  },

  async close() {
    if (!redis) return;
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  },
};

// Exposed for the rate-limit store, which needs the raw client to send commands.
export const redisClient = redis;
