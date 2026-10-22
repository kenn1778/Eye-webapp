import { Resend } from "resend";
import { config } from "../config.js";
import { logger } from "./logger.js";

// Loose but strict-enough check: one "@", no whitespace, a dot in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const seen = new Set();
  for (const candidate of list) {
    if (typeof candidate !== "string") continue;
    const address = candidate.trim();
    if (EMAIL_RE.test(address)) seen.add(address);
  }
  return [...seen];
}

// Thin wrapper over Resend. When the provider is not configured (no API key or
// no verified sender) sending is skipped and logged instead of throwing, so the
// application flows that depend on email keep working in development.
class EmailService {
  #client = null;

  get configured() {
    return Boolean(config.resendApiKey && config.emailFrom);
  }

  #resend() {
    if (!this.#client) this.#client = new Resend(config.resendApiKey);
    return this.#client;
  }

  async send({ to, subject, text, html = null, replyTo = null, tag = null } = {}) {
    const recipients = normalizeRecipients(to);
    if (recipients.length === 0) throw new Error("email requires at least one valid recipient");
    if (!subject) throw new Error("email requires a subject");

    if (!this.configured) {
      logger.warn(
        { tag, to: recipients, subject },
        "[eye:mail] skipped - set RESEND_API_KEY and EMAIL_FROM to enable delivery",
      );
      return { skipped: true, id: null };
    }

    const payload = {
      from: config.emailFrom,
      to: recipients,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { replyTo } : {}),
    };

    try {
      const { data, error } = await this.#resend().emails.send(payload, {
        signal: AbortSignal.timeout(config.emailTimeoutMs),
      });
      if (error) throw new Error(error.message ?? "provider rejected the message");
      logger.info({ tag, to: recipients, subject, id: data?.id }, "[eye:mail] sent");
      return { skipped: false, id: data?.id ?? null };
    } catch (error) {
      // Surface a compact reason so callers can decide whether to retry.
      throw new Error(`resend: ${error.message}`);
    }
  }
}

export const emailService = new EmailService();
