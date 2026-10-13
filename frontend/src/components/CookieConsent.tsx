import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readString, removeItem, writeString } from "../lib/storage";

type Consent = "accepted" | "rejected";

const CONSENT_KEY = "eye:consent";
const CONSENT_EVENT = "eye-consent";
const BANNER_DELAY_MS = 800;

function isConsent(value: string | null): value is Consent {
  return value === "accepted" || value === "rejected";
}

function loadConsent(): Consent | null {
  const stored = readString(CONSENT_KEY);
  return isConsent(stored) ? stored : null;
}

export function CookieConsent() {
  const [consent, setConsent] = useState<Consent | null>(loadConsent);
  const [showSettings, setShowSettings] = useState(false);
  // Returning visitors who already chose never see the banner; skip the delay for them.
  const [isReady, setIsReady] = useState(() => readString(CONSENT_KEY) !== null);

  useEffect(() => {
    if (consent !== null) return;
    const timer = window.setTimeout(() => setIsReady(true), BANNER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [consent]);

  const save = (value: Consent) => {
    writeString(CONSENT_KEY, value);
    setConsent(value);
    setShowSettings(false);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  };

  const resetChoice = () => {
    removeItem(CONSENT_KEY);
    setConsent(null);
  };

  // Hide completely after a choice is made. Banner only shows once per browser.
  if (consent !== null && !showSettings) {
    return null;
  }

  const isBannerVisible = (consent === null && isReady) || showSettings;

  if (!isBannerVisible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="dialog" aria-modal="true" aria-labelledby="cookie-title" aria-describedby="cookie-desc">
      <div className="cookie-card">
        <h2 id="cookie-title" className="eyebrow">Cookies</h2>
        <p id="cookie-desc">
          We use strictly necessary cookies to run the site. With your consent, we use analytics to see what is useful.
          No ads, no sale of data. See <Link to="/cookies">Cookies</Link> and <Link to="/privacy">Privacy</Link>.
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
            <p>
              <strong>Current choice:</strong> {consent === "accepted" ? "Analytics allowed" : "Only necessary"}
            </p>
            <button className="button-secondary" type="button" onClick={resetChoice}>Reset choice</button>
          </div>
        )}
      </div>
    </div>
  );
}
