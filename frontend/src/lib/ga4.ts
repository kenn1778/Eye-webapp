// Optional Google Analytics 4 (GA4) collection.
//
// Enable by building with VITE_GA4_ID=G-XXXXXXXXXX set (frontend/.env). When
// unset - or when the build env var is missing so the placeholder never
// resolves - nothing loads, nothing ships a network call, and the app behaves
// exactly as before. The measurement id is public by design (it appears in
// every page's network traffic), so it is safe to bundle.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const raw = (import.meta.env.VITE_GA4_ID ?? "") as string;
// Vite substitutes %VITE_GA4_ID% inside index.html, but import.meta.env only
// carries it into JS when the variable was present at build time. Guard both
// against the raw unreplaced literal and against imports.meta.* leakage.
export const GA4_ID = raw && !raw.includes("%") && raw.startsWith("G-") ? raw : "";

let initialized = false;

export function initGA4(): void {
  if (!GA4_ID || initialized) return;
  initialized = true;
  try {
    // Standard gtag.js bootstrap, injected at runtime instead of baked into
    // index.html so builds without a measurement id ship no analytics artifact.
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_ID, {
      // The SPA does client-side routing; automatic page_view on load would
      // double-count with the route tracker below.
      send_page_view: false,
    });
  } catch {
    // Script injection blocked (extension/CSP) must never break the app.
    initialized = true;
  }
}

let lastPath: string | null = null;

export function trackPageView(path: string, title = document.title): void {
  if (!GA4_ID || !window.gtag) return;
  if (path === lastPath) return; // dedupe replace navigations to the same route
  lastPath = path;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title,
  });
}
