// Premium membership API client. Every call is inert until the backend has a
// Paystack key configured (the plans endpoint then reports enabled: false).

const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export type MembershipPlan = {
  id: string;
  name: string;
  interval: string;
  amountKobo: number;
};

export type PlansResponse = {
  enabled: boolean;
  currency: string;
  plans: MembershipPlan[];
};

export async function fetchPlans(): Promise<PlansResponse> {
  const response = await fetch(`${apiBase}/api/v1/membership/plans`);
  if (!response.ok) throw new Error("Could not load membership plans.");
  return (await response.json()) as PlansResponse;
}

export async function startCheckout(
  email: string,
  plan: string,
): Promise<{ authorizationUrl: string; reference: string }> {
  const response = await fetch(`${apiBase}/api/v1/membership/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, plan }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    authorizationUrl?: string;
    reference?: string;
  };
  if (!response.ok || !data.authorizationUrl) {
    throw new Error(data.message || "Could not start checkout.");
  }
  return { authorizationUrl: data.authorizationUrl, reference: data.reference ?? "" };
}

export async function verifyCheckout(
  reference: string,
): Promise<{ status: string; active: boolean; plan: string }> {
  const response = await fetch(
    `${apiBase}/api/v1/membership/verify?reference=${encodeURIComponent(reference)}`,
  );
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    status?: string;
    active?: boolean;
    plan?: string;
  };
  if (!response.ok) throw new Error(data.message || "Could not verify payment.");
  return { status: data.status ?? "unknown", active: Boolean(data.active), plan: data.plan ?? "premium" };
}

export function formatPrice(amountKobo: number, currency: string): string {
  const amount = amountKobo / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
