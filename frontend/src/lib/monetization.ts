// Monetization configuration and helpers.
//
// Every switch here is inert until its Vite env var is set, so the default
// build ships no ads, no third-party analytics, and no affiliate tagging.
// See .env.example for the variables.

const env = import.meta.env;

// Google AdSense publisher id, e.g. "ca-pub-1234567890123456".
export const ADSENSE_CLIENT = (env.VITE_ADSENSE_CLIENT ?? "").trim();

// Privacy-friendly analytics domain (Plausible-style), e.g. "eye.example.com".
export const ANALYTICS_DOMAIN = (env.VITE_ANALYTICS_DOMAIN ?? "").trim();

// Tag outbound opportunity links as affiliate/sponsored when true.
export const AFFILIATE_ENABLED = env.VITE_AFFILIATE_ENABLED === "true";

export const ADS_ENABLED = ADSENSE_CLIENT.length > 0;
export const ANALYTICS_ENABLED = ANALYTICS_DOMAIN.length > 0;

// Ad unit ids per placement, created in the AdSense dashboard. A placement with
// no id simply renders nothing.
export type AdPlacement = "leaderboard" | "in-content" | "footer";

export const AD_SLOTS: Record<AdPlacement, string> = {
  leaderboard: (env.VITE_ADSENSE_SLOT_LEADERBOARD ?? "").trim(),
  "in-content": (env.VITE_ADSENSE_SLOT_INCONTENT ?? "").trim(),
  footer: (env.VITE_ADSENSE_SLOT_FOOTER ?? "").trim(),
};

export function isExternalUrl(url: string | undefined): boolean {
  if (!url || typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

// rel for outbound links. Affiliate/sponsored destinations must be disclosed to
// search engines; everything else keeps the plain referrer policy.
export function outboundRel(url: string | undefined): string {
  return isExternalUrl(url) && AFFILIATE_ENABLED
    ? "sponsored nofollow noopener noreferrer"
    : "noreferrer";
}
