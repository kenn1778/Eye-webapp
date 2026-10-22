import { logger } from "./logger.js";
import { emailService } from "./email.js";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Email can fail transiently (provider 5xx, network blip), so each send gets a
// couple of retries with a short backoff before the job is logged and dropped.
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [500, 2000];

async function sendWithRetry(tag, deliver) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await deliver();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new Error(`${error.message} (gave up after ${attempt} attempts)`);
      }
      const delay = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      logger.warn(
        { tag, attempt, err: error.message, retryInMs: delay },
        "[eye:mail] send failed - retrying",
      );
      await sleep(delay);
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(heading, bodyHtml) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.5">
  <h2 style="margin:0 0 12px">${escapeHtml(heading)}</h2>
  ${bodyHtml}
  <p style="color:#666;font-size:12px;margin-top:24px">EYE Scholarships</p>
</body></html>`;
}

function button(label, url) {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:20px 0"><a href="${safeUrl}" style="background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>
  <p style="color:#666;font-size:12px;word-break:break-all">Or paste this link into your browser:<br>${safeUrl}</p>`;
}

// Job handlers. Each one validates its payload, sends through the EmailService
// (which is a no-op that logs when Resend is not configured), and retries.
export function registerEmailJobs() {
  on("newsletter.confirm", (payload = {}) => {
    const { to, confirmUrl } = payload;
    if (!to || !confirmUrl) throw new Error("newsletter.confirm requires { to, confirmUrl }");
    return sendWithRetry("newsletter.confirm", () =>
      emailService.send({
        to,
        subject: "Confirm your EYE Scholarships subscription",
        text: `Confirm your subscription by opening this link:\n${confirmUrl}\n\nIf you did not sign up, ignore this email.`,
        html: layout(
          "Confirm your subscription",
          `<p>One click and you are on the list for new scholarships and updates.</p>${button("Confirm subscription", confirmUrl)}`,
        ),
        tag: "newsletter.confirm",
      }),
    );
  });

  on("password.reset", (payload = {}) => {
    const { to, resetUrl, expiresInMinutes = 30 } = payload;
    if (!to || !resetUrl) throw new Error("password.reset requires { to, resetUrl }");
    return sendWithRetry("password.reset", () =>
      emailService.send({
        to,
        subject: "Reset your EYE Scholarships password",
        text: `Reset your password within ${expiresInMinutes} minutes:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        html: layout(
          "Reset your password",
          `<p>This link expires in ${escapeHtml(expiresInMinutes)} minutes.</p>${button("Reset password", resetUrl)}<p>If you did not request a reset, you can ignore this email.</p>`,
        ),
        tag: "password.reset",
      }),
    );
  });

  // Generic passthrough for notifications and one-off mail (admin digests,
  // membership receipts). Callers supply the rendered subject and body.
  on("email.send", (payload = {}) => {
    const { to, subject, text, html = null, replyTo = null } = payload;
    if (!to || !subject || !text) throw new Error("email.send requires { to, subject, text }");
    return sendWithRetry("email.send", () =>
      emailService.send({ to, subject, text, html, replyTo, tag: "email.send" }),
    );
  });
}