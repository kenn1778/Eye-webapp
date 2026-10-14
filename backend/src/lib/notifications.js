import { prisma } from "./prisma.js";
import { logger } from "./logger.js";

// Reduce an address to something safe to show in the admin feed, e.g.
// "jane.doe@example.com" -> "j***e@example.com". The full address stays in the
// NewsletterSubscriber table; the notification only carries the masked form.
export function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return "someone";
  const [local, domain] = email.split("@");
  if (!local) return `***@${domain}`;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

// Fire-and-forget: a notification is a side effect of a domain event, so a
// failure here must never break the request that triggered it.
export async function createNotification({ type, title, body = null, actor = null }) {
  try {
    await prisma.notification.create({ data: { type, title, body, actor } });
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:notify] could not persist notification");
  }
}
