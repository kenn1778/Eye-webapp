// End-to-end check for the password-reset flow and the newsletter double
// opt-in, executed INSIDE the backend container so it talks to the real
// database and the real Redis rate limiters.
//
// The mailer is patched at runtime to capture the message that would have been
// sent, which is how the raw reset token becomes visible without a mail
// provider. Run it with:
//   docker compose exec -T -e PORT=4010 backend node /tmp/e2e-auth-flow.mjs

import { createRequire } from "node:module";

const require = createRequire("/app/package.json");
const bcrypt = require("bcryptjs");
const { config } = await import("/app/src/config.js");
const { prisma } = await import("/app/src/lib/prisma.js");
const { emailService } = await import("/app/src/lib/email.js");

const captured = [];
emailService.send = async (payload) => {
  captured.push(payload);
  return { skipped: true, id: null };
};

const BASE = `http://127.0.0.1:${config.port}`;
const EMAIL = "e2e-reset@example.com";
const OLD_PASSWORD = "OldPassw0rd!";
const NEW_PASSWORD = "NewPassw0rd!";

let failures = 0;
function check(name, ok, extra = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? ` :: ${extra}` : ""}`);
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload, headers: response.headers };
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`);
  const text = await response.text();
  return { status: response.status, text };
}

// ---------------------------------------------------------------- fixtures
await prisma.user.deleteMany({ where: { email: EMAIL } });
await prisma.passwordResetToken.deleteMany({ where: { email: EMAIL } });
await prisma.newsletterSubscriber.deleteMany({ where: { email: EMAIL } });
await prisma.user.create({
  data: {
    email: EMAIL,
    name: "E2E User",
    passwordHash: await bcrypt.hash(OLD_PASSWORD, 12),
  },
});

// Start the API on the port set for this run.
await import("/app/src/server.js");
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const probe = await fetch(`${BASE}/healthz`);
    if (probe.status === 200) break;
  } catch {
    // not listening yet
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
check("api is listening", true, BASE);

// ------------------------------------------------------- forgot-password
const unknownEmail = `nobody-${Date.now()}@example.com`;
const unknown = await post("/api/v1/auth/forgot-password", { email: unknownEmail });
check(
  "forgot-password for an unknown address answers 200 with a generic message",
  unknown.status === 200 && /reset link has been sent/i.test(unknown.body?.message ?? ""),
  `${unknown.status} ${unknown.body?.message}`,
);
check(
  "forgot-password for an unknown address creates no token",
  (await prisma.passwordResetToken.count({ where: { email: unknownEmail } })) === 0,
);

const requested = await post("/api/v1/auth/forgot-password", { email: EMAIL });
check("forgot-password for a known address answers 200", requested.status === 200, String(requested.status));

const stored = await prisma.passwordResetToken.findFirst({ where: { email: EMAIL } });
check(
  "a reset token row is stored as a sha256 hash, unused and unexpired",
  Boolean(stored) && /^[0-9a-f]{64}$/.test(stored.tokenHash) && !stored.usedAt && stored.expiresAt > new Date(),
  stored ? `hashLen=${stored.tokenHash.length}` : "no row",
);
check(
  "the stored row does not contain the raw token",
  Boolean(stored) && !stored.tokenHash.includes("ey") && stored.tokenHash.length === 64,
);

const resetMail = captured.find((mail) => mail.tag === "password.reset");
check("a password.reset mail was queued", Boolean(resetMail), resetMail ? resetMail.subject : "no mail");
const resetLink = /https?:\/\/\S+/.exec(resetMail?.text ?? "")?.[0] ?? "";
const token = resetLink ? new URL(resetLink).searchParams.get("token") : null;
check("the reset link carries a token", Boolean(token) && token.length >= 16);
check(
  "the reset link points at the web app, not the API",
  Boolean(resetLink) && !resetLink.includes("/api/"),
  resetLink,
);

// -------------------------------------------------------- reset-password
const weak = await post("/api/v1/auth/reset-password", { token, password: "weak" });
check(
  "a weak new password is rejected",
  weak.status === 400 && /at least 8 characters/i.test(weak.body?.message ?? ""),
  `${weak.status} ${weak.body?.message}`,
);

const forged = await post("/api/v1/auth/reset-password", { token: "x".repeat(40), password: NEW_PASSWORD });
check(
  "an unknown token is rejected",
  forged.status === 400 && /invalid or has expired/i.test(forged.body?.message ?? ""),
  `${forged.status} ${forged.body?.message}`,
);

const applied = await post("/api/v1/auth/reset-password", { token, password: NEW_PASSWORD });
check(
  "the new password is accepted",
  applied.status === 200 && /password updated/i.test(applied.body?.message ?? ""),
  `${applied.status} ${applied.body?.message}`,
);

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
check(
  "the stored hash now matches the new password",
  Boolean(user) && (await bcrypt.compare(NEW_PASSWORD, user.passwordHash)) && !(await bcrypt.compare(OLD_PASSWORD, user.passwordHash)),
);
check(
  "the token is marked used and no other token is left for the address",
  Boolean(stored) && Boolean(await prisma.passwordResetToken.findFirst({ where: { email: EMAIL, usedAt: { not: null } } }))
    && (await prisma.passwordResetToken.count({ where: { email: EMAIL } })) === 1,
);

const replay = await post("/api/v1/auth/reset-password", { token, password: "YetAnother1!" });
check(
  "the same token cannot be used twice",
  replay.status === 400 && /invalid or has expired/i.test(replay.body?.message ?? ""),
  `${replay.status} ${replay.body?.message}`,
);

// ------------------------------------------------------------- sign-in
const signedIn = await post("/api/v1/auth/login", { email: EMAIL, password: NEW_PASSWORD });
check(
  "signing in with the new password works",
  signedIn.status === 200 && signedIn.body?.user?.email === EMAIL,
  `${signedIn.status} ${JSON.stringify(signedIn.body?.user ?? null)}`,
);
const cookie = signedIn.headers
  .getSetCookie?.()
  ?.find((entry) => /(^|,\s)(eye-session|__Host-session)=/.test(entry));
check("a session cookie is issued", Boolean(cookie), cookie ? cookie.split("=")[0] : "none");

const stale = await post("/api/v1/auth/login", { email: EMAIL, password: OLD_PASSWORD });
check("the old password no longer works", stale.status === 401, String(stale.status));

const me = await fetch(`${BASE}/api/v1/auth/me`, { headers: { cookie: cookie ?? "" } });
check("the session works on /auth/me", me.status === 200, String(me.status));

// ------------------------------------------------- newsletter opt-in
const subscribed = await post("/api/v1/newsletter/subscribe", { email: EMAIL, source: "e2e" });
check("newsletter subscribe answers 200", subscribed.status === 200, String(subscribed.status));
const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
check("the subscriber row exists and is not confirmed yet", Boolean(subscriber) && subscriber.confirmed === false);

const confirmMail = captured.find((mail) => mail.tag === "newsletter.confirm");
check("a newsletter.confirm mail was queued", Boolean(confirmMail));
const confirmLink = /https?:\/\/\S+/.exec(confirmMail?.text ?? "")?.[0] ?? "";
const confirmToken = confirmLink ? new URL(confirmLink).searchParams.get("token") : null;
check("the confirmation link carries a token", Boolean(confirmToken));

const tampered = await get(`/api/v1/newsletter/confirm?token=${encodeURIComponent(`${confirmToken}x`)}`);
check("a tampered confirmation token is rejected", tampered.status === 400, String(tampered.status));

const confirmed = await get(`/api/v1/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`);
check(
  "the confirmation link confirms the subscription",
  confirmed.status === 200 && /Subscription confirmed/i.test(confirmed.text),
  String(confirmed.status),
);
const afterConfirm = await prisma.newsletterSubscriber.findUnique({ where: { email: EMAIL } });
check("the subscriber row is marked confirmed", Boolean(afterConfirm) && afterConfirm.confirmed === true);

const again = await get(`/api/v1/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`);
check("confirming twice stays successful", again.status === 200, String(again.status));

// -------------------------------------------------------------- cleanup
await prisma.user.deleteMany({ where: { email: EMAIL } });
await prisma.passwordResetToken.deleteMany({ where: { email: EMAIL } });
await prisma.newsletterSubscriber.deleteMany({ where: { email: EMAIL } });

console.log(failures === 0 ? "RESULT PASS" : `RESULT FAIL (${failures} failed)`);
process.exit(failures === 0 ? 0 : 1);