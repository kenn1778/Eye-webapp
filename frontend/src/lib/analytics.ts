// Consent-gated, privacy-friendly analytics.
//
// The script is injected only after the visitor accepts analytics in the cookie
// banner (the "eye-consent" event), and never when VITE_ANALYTICS_DOMAIN is
// unset. Nothing loads before consent.

import { ANALYTICS_DOMAIN, ANALYTICS_ENABLED } from "./monetization";
import { readString } from "./storage";

const CONSENT_KEY = "eye:consent";
const CONSENT_EVENT = "eye-consent";
const SCRIPT_ID = "eye-analytics";
const SCRIPT_SRC = "https://plausible.io/js/script.js";

let loaded = false;

function inject(): void {
  if (loaded || !ANALYTICS_ENABLED || typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) {
    loaded = true;
    return;
  }
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.defer = true;
  script.dataset.domain = ANALYTICS_DOMAIN;
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);
  loaded = true;
}

export function initAnalytics(): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (readString(CONSENT_KEY) === "accepted") inject();
  window.addEventListener(CONSENT_EVENT, (event) => {
    if ((event as CustomEvent<string>).detail === "accepted") inject();
  });
}

// Fire a custom event when analytics is active; a no-op otherwise.
export function trackEvent(name: string, props?: Record<string, string | number>): void {
  if (!loaded) return;
  const plausible = (window as unknown as { plausible?: (n: string, o?: { props?: unknown }) => void }).plausible;
  plausible?.(name, props ? { props } : undefined);
}
