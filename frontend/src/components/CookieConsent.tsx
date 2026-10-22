import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readString, writeString } from "../lib/storage";

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

  useEffect(() => {
    const openPreferences = () => setShowSettings(true);
    window.addEventListener("eye-open-cookie-settings", openPreferences);
    return () => window.removeEventListener("eye-open-cookie-settings", openPreferences);
  }, []);

  const save = (value: Consent) => {
    writeString(CONSENT_KEY, value);
    setConsent(value);
    setShowSettings(false);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  };

  // Collapse after a choice, but retain a small control so the preference can be changed later.
  if (consent !== null && !showSettings) {
    return (
      <button className="cookie-settings-link" type="button" onClick={() => setShowSettings(true)}>
        Cookie preferences
      </button>
    );
  }

  const isBannerVisible = (consent === null && isReady) || showSettings;

  if (!isBannerVisible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="dialog" aria-labelledby="cookie-title" aria-describedby="cookie-desc">
      <div className="cookie-card">
        <div className="cookie-main">
          <div className="cookie-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M26.7 16.3a10.8 10.8 0 1 1-11-11c-.3 3.7 2.8 6.8 6.5 6.5-.3 2.3 1.8 4.6 4.5 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/><circle cx="17" cy="21" r="1.3" fill="currentColor"/><circle cx="10" cy="19" r="1.3" fill="currentColor"/></svg>
          </div>
          <div className="cookie-copy">
            <span className="cookie-kicker">Your privacy</span>
            <h2 id="cookie-title">A little choice about cookies</h2>
            <p id="cookie-desc">
              Necessary cookies keep EYE working. With your permission, analytics help us understand what readers find useful. No ads and no sale of your data. <Link to="/cookies">Cookie details</Link>
            </p>
          </div>
        </div>
        <div className="cookie-controls">
          {!showSettings && (
            <div className="cookie-actions">
              <button className="cookie-reject" type="button" onClick={() => save("rejected")}>Reject optional</button>
              <button className="cookie-accept" type="button" onClick={() => save("accepted")}>Accept all</button>
            </div>
          )}
          <button className="cookie-manage" type="button" aria-expanded={showSettings} onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? "Close preferences" : "Manage preferences"}
          </button>
        </div>
        {showSettings && (
          <div className="cookie-settings">
            <p><strong>Necessary cookies</strong> are always on. Choose whether to allow optional analytics.{consent !== null && <> Current choice: {consent === "accepted" ? "analytics allowed" : "necessary only"}.</>}</p>
            <div className="cookie-settings-actions">
              <button className="cookie-reject" type="button" onClick={() => save("rejected")}>Necessary only</button>
              <button className="cookie-accept" type="button" onClick={() => save("accepted")}>Allow analytics</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
