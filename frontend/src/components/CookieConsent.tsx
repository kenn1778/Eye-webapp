import { useEffect, useState } from "react";

type Consent = "accepted" | "rejected" | null;

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(() => {
    try {
      return (localStorage.getItem("eye:consent") as Consent) || null;
    } catch {
      return null;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isReady, setIsReady] = useState(() => {
    try {
      return localStorage.getItem("eye:consent") !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (consent !== null) return;
    const t = window.setTimeout(() => setIsReady(true), 800);
    return () => window.clearTimeout(t);
  }, [consent]);

  // Persist and dispatch event so analytics can listen
  const save = (value: Consent) => {
    if (!value) return;
    localStorage.setItem("eye:consent", value);
    setConsent(value);
    setShowSettings(false);
    window.dispatchEvent(new CustomEvent("eye-consent", { detail: value }));
    // Example: only enable analytics if accepted
    // if (value === "accepted") enableAnalytics();
  };

  // If user already chose, hide banner unless they open settings
  const isVisible = (consent === null && isReady) || showSettings;

  if (!isVisible) {
    return (
      <button
        className="cookie-settings-link"
        type="button"
        onClick={() => setShowSettings(true)}
        aria-label="Open cookie settings"
      >
        Cookie settings
      </button>
    );
  }

  return (
    <div className="cookie-banner" role="dialog" aria-modal="true" aria-labelledby="cookie-title" aria-describedby="cookie-desc">
      <div className="cookie-card">
        <h2 id="cookie-title" className="eyebrow">Cookies</h2>
        <p id="cookie-desc">
          We use strictly necessary cookies to run the site. With your consent, we use analytics to see what is useful.
          No ads, no sale of data. See <a href="/cookies">Cookies</a> and <a href="/privacy">Privacy</a>.
        </p>
        <div className="cookie-actions">
          <button className="button-secondary" type="button" onClick={() => save("rejected")}>Reject non-essential</button>
          <button className="admin-primary" type="button" onClick={() => save("accepted")}>Accept</button>
        </div>
        <button className="cookie-manage" type="button" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? "Close settings" : "Manage preferences"}
        </button>
        {showSettings && consent !== null && (
          <div className="cookie-settings">
            <p><strong>Current choice:</strong> {consent === "accepted" ? "Analytics allowed" : "Only necessary"}</p>
            <button className="button-secondary" type="button" onClick={() => { localStorage.removeItem("eye:consent"); setConsent(null); }}>Reset choice</button>
          </div>
        )}
      </div>
    </div>
  );
}
