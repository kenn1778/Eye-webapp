import { MemoryStore } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./cache.js";
import { logger } from "./logger.js";

let warned = false;

function warnOnce(message) {
  if (warned) return;
  warned = true;
  logger.warn(`[eye:ratelimit] ${message}`);
}

// Redis-backed store that is only constructed once the client reports "ready".
// rate-limit-redis eagerly runs SCRIPT LOAD in its constructor, so building it
// against a dead connection would reject an internal promise and crash the
// process. Until Redis is ready - and whenever an operation fails - we count in
// memory instead of failing the request.
class LazyRedisStore {
  localKeys = true;

  #prefix;
  #memory = new MemoryStore();
  #redisStore = null;
  #options = null;

  constructor(prefix) {
    this.#prefix = prefix;
  }

  init(options) {
    this.#options = options;
    this.#memory.init(options);
  }

  #ensureRedis() {
    if (this.#redisStore) return this.#redisStore;
    if (!redisClient || redisClient.status !== "ready") return null;
    try {
      const store = new RedisStore({
        prefix: this.#prefix,
        sendCommand: (...args) => redisClient.call(...args),
      });
      // The constructor starts SCRIPT LOAD; swallow any rejection so a Redis
      // blip cannot surface as an unhandled promise rejection.
      store.incrementScriptSha?.catch(() => {});
      store.getScriptSha?.catch(() => {});
      if (this.#options) store.init(this.#options);
      this.#redisStore = store;
      return store;
    } catch (error) {
      warnOnce(`could not create redis store, using memory: ${error.message}`);
      return null;
    }
  }

  async #run(method, key) {
    const store = this.#ensureRedis();
    if (store) {
      try {
        return await store[method](key);
      } catch (error) {
        warnOnce(`redis ${method} failed, using memory: ${error.message}`);
      }
    }
    return this.#memory[method](key);
  }

  get(key) {
    return this.#run("get", key);
  }

  increment(key) {
    return this.#run("increment", key);
  }

  decrement(key) {
    return this.#run("decrement", key);
  }

  resetKey(key) {
    return this.#run("resetKey", key);
  }

  async resetAll() {
    await this.#memory.resetAll();
  }

  shutdown() {
    this.#memory.shutdown?.();
  }
}

// Returns a fresh store per limiter. With no REDIS_URL this is just the default
// in-memory store; with Redis configured it is Redis-backed with a memory
// safety net.
export function createRateLimitStore(prefix) {
  if (!redisClient) return new MemoryStore();
  return new LazyRedisStore(prefix);
}
