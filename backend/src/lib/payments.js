import crypto from "node:crypto";
import { config } from "../config.js";

// Paystack payment provider.
//
// Everything here is inert until PAYSTACK_SECRET_KEY is set, so the API runs
// without a payment account configured. Amounts are in the smallest currency
// unit (kobo for NGN).

const PAYSTACK_BASE = "https://api.paystack.co";

export const paymentsEnabled = Boolean(config.paystackSecretKey);

async function paystackRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === false) {
    throw new Error(data?.message || `Paystack request failed (${response.status})`);
  }
  return data.data;
}

// Start a transaction and return the hosted checkout URL.
export async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl || undefined,
      metadata,
    },
  });
}

export async function verifyTransaction(reference) {
  return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Paystack signs webhooks with HMAC-SHA512 of the raw request body using the
// secret key. Compare in constant time.
export function verifyWebhookSignature(rawBody, signature) {
  if (!config.paystackSecretKey || !signature || !rawBody) return false;
  const expected = crypto
    .createHmac("sha512", config.paystackSecretKey)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
