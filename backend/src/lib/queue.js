import { logger } from "./logger.js";

// Minimal in-process job queue. It is deliberately dependency-free: jobs sit in
// an array and a single setImmediate worker drains them in order. This is a
// placeholder for a real broker (BullMQ/SQS) - it does not survive a restart.
const handlers = new Map();
const jobs = [];

let scheduled = false;
let processing = false;

export function on(name, handler) {
  if (typeof handler !== "function") {
    throw new TypeError("queue.on(name, handler) requires a handler function");
  }
  handlers.set(name, handler);
}

export function enqueue(name, payload) {
  jobs.push({ name, payload, queuedAt: Date.now() });
  schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setImmediate(run);
}

async function run() {
  scheduled = false;
  processing = true;
  try {
    while (jobs.length > 0) {
      const job = jobs.shift();
      const handler = handlers.get(job.name);
      if (!handler) {
        logger.warn({ job: job.name }, "[eye:queue] no handler registered for job");
        continue;
      }
      try {
        await handler(job.payload, job);
      } catch (error) {
        logger.error({ job: job.name, err: error.message }, "[eye:queue] job failed");
      }
    }
  } finally {
    processing = false;
    // A job enqueued while the worker was between iterations still needs a kick.
    if (jobs.length > 0) schedule();
  }
}

// Resolves once the queue is empty (or the timeout elapses), so shutdown can
// flush in-flight jobs before the process exits.
export async function drain(timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while ((jobs.length > 0 || processing || scheduled) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// Placeholder email handlers. Nothing is actually sent; we just record what
// would go out so the flow can be verified end to end.
export function registerEmailJobs() {
  const logEmail = (payload, job) => {
    logger.info(
      { job: job?.name, payload },
      "[eye:mail] email queued (placeholder - no SMTP configured)",
    );
  };

  on("newsletter.confirm", logEmail);
  on("email.send", logEmail);
  on("password.reset", logEmail);
}
