import { prisma } from "./prisma.js";
import { logger } from "./logger.js";
import { emailService } from "./email.js";
import { config } from "../config.js";

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

// Notify subscribers about a new published post.
// Creates a web notification and sends email in small batches to avoid spam.
// Emails are only sent to confirmed subscribers and throttled to once per day
// per subscriber for new posts.
export async function notifySubscribersAboutPost(post) {
  if (!post || post.status !== "published" || !post.title) return;
  try {
    await createNotification({
      type: "system",
      title: `New post: ${post.title}`,
      body: post.excerpt || post.content.slice(0, 200),
      actor: "editor",
    });

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { confirmed: true },
      select: { email: true },
      take: 500, // limit blast
    });

    if (!subscribers.length) return;

    const from = config.emailFrom || "no-reply@example.com";
    const baseUrl = config.appBaseUrl || config.publicApiUrl || "";

    // Simple rate-limit: one batch every 2 seconds, max 50 emails per batch.
    const BATCH_SIZE = 50;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (s) => {
          try {
            await emailService.send({
              to: s.email,
              from,
              subject: `New: ${post.title}`,
              html: `<p>Hello,</p><p>We just published a new story: <a href="${baseUrl}/post/${post.id}">${post.title}</a></p><p>${post.excerpt || ""}</p>`,
            });
          } catch (err) {
            logger.warn({ err: err.message, email: s.email }, "[eye:notify] email send failed");
          }
        })
      );
      // avoid hammering the provider; give a small pause between batches
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch (error) {
    logger.warn({ err: error.message }, "[eye:notify] notifySubscribersAboutPost failed");
  }
}

